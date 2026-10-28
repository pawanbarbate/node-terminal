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

  const callbacksRef = useRef<ProcessCallbacks>({
    onLog: (serviceName: string, log: LogEntry) => {
      if (isLiveRef.current) {
        dispatch({ type: 'APPEND_REAL_LOG', serviceName, log });
      }
    },
    onStatusChange: (serviceName: string, status, pid, error, statusText) => {
      dispatch({ type: 'PROCESS_STATUS_CHANGED', serviceName, status, pid, error, statusText });
    }
  });

  // 1. Clock interval (1s)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hh}:${mm}:${ss}`;
      const cpuChange = Math.random() > 0.5 ? 1 : -1;

      dispatch({
        type: 'TICK_CLOCK',
        time: timeStr,
        cpuChange
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [dispatch]);

  // 2. Start all auto-start configured services on mount
  useEffect(() => {
    if (!config || !config.services || config.services.length === 0) {
      return;
    }

    processManager.startAll(config.services, callbacksRef.current);

    return () => {
      processManager.stopAll().catch(() => {});
    };
  }, [config]);

  // 3. Restart service handler
  const handleRestart = useCallback(async (index: number) => {
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
  }, [dispatch]);

  // 4. Toggle stop / run service handler
  const handleToggleStop = useCallback(async (index: number) => {
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
  }, [dispatch]);

  return {
    handleRestart,
    handleToggleStop
  };
}

