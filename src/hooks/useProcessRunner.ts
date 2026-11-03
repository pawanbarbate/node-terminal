import React, { useEffect, useRef, useCallback } from 'react';
import { DashboardAction, DashboardState } from '../state/dashboardReducer.js';
import { DevPulseConfig } from '../types/config.js';
import { ProcessCallbacks, LogEntry } from '../types/index.js';
import { processManager } from '../services/processManager.js';

export interface UseProcessRunnerProps {
  config?: DevPulseConfig;
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
}

export function useProcessRunner({ config, state, dispatch }: UseProcessRunnerProps) {
  const isLiveRef = useRef(state.isLive);
  isLiveRef.current = state.isLive;

  const servicesRef = useRef(state.services);
  servicesRef.current = state.services;

  const pausedBufferRef = useRef<{ serviceName: string; log: LogEntry }[]>([]);

  // Flush buffered logs when live mode resumes
  useEffect(() => {
    if (state.isLive && pausedBufferRef.current.length > 0) {
      const buffered = pausedBufferRef.current.splice(0, pausedBufferRef.current.length);
      for (const item of buffered) {
        dispatch({ type: 'APPEND_REAL_LOG', serviceName: item.serviceName, log: item.log });
      }
    }
  }, [state.isLive, dispatch]);

  const callbacksRef = useRef<ProcessCallbacks>({
    onLog: (serviceName: string, log: LogEntry) => {
      if (isLiveRef.current) {
        dispatch({ type: 'APPEND_REAL_LOG', serviceName, log });
      } else {
        pausedBufferRef.current.push({ serviceName, log });
        if (pausedBufferRef.current.length > 500) {
          pausedBufferRef.current.shift();
        }
      }
    },
    onStatusChange: (serviceName: string, status, pid, error, statusText) => {
      dispatch({ type: 'PROCESS_STATUS_CHANGED', serviceName, status, pid, error, statusText });
    }
  });

  // 1. Start all auto-start configured services on mount with pacing & concurrency settings
  useEffect(() => {
    if (!config || !config.services || config.services.length === 0) {
      return;
    }

    processManager.startAll(config.services, callbacksRef.current, config.settings);

    return () => {
      processManager.stopAll().catch(() => {});
    };
  }, [config]);

  // 3. Restart service handler
  const handleRestart = useCallback(async (index: number) => {
    if (!config?.services || config.services.length === 0) return;
    const service = servicesRef.current[index];
    if (!service) return;

    dispatch({ type: 'START_RESTART_SERVICE', index });
    const targetConfig = service.rawConfig || {
      name: service.name,
      path: service.path || '.',
      command: service.command,
      autoStart: true
    };
    await processManager.restartService(service.name, callbacksRef.current, targetConfig);
  }, [config, dispatch]);

  // 4. Toggle stop / run service handler
  const handleToggleStop = useCallback(async (index: number) => {
    if (!config?.services || config.services.length === 0) return;
    const service = servicesRef.current[index];
    if (!service) return;

    if (service.status === 'running') {
      dispatch({ type: 'PROCESS_STATUS_CHANGED', serviceName: service.name, status: 'stopped' });
      await processManager.stopService(service.name, callbacksRef.current);
    } else {
      dispatch({ type: 'PROCESS_STATUS_CHANGED', serviceName: service.name, status: 'starting' });
      const targetConfig = service.rawConfig || {
        name: service.name,
        path: service.path || '.',
        command: service.command,
        autoStart: true
      };
      await processManager.startService(targetConfig, callbacksRef.current);
    }
  }, [config, dispatch]);

  return {
    handleRestart,
    handleToggleStop
  };
}

