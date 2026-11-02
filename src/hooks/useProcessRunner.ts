import React, { useEffect, useRef, useCallback } from 'react';
import { DashboardAction, DashboardState } from '../state/dashboardReducer.js';
import { DevPulseConfig } from '../types/config.js';
import { ProcessCallbacks, LogEntry } from '../types/index.js';
import { processManager } from '../services/processManager.js';
import { logger } from '../logger/logger.js';

export interface UseProcessRunnerProps {
  config?: DevPulseConfig;
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
}

export function useProcessRunner({ config, state, dispatch }: UseProcessRunnerProps) {
  const isMountedRef = useRef(true);

  const servicesRef = useRef(state.services);
  servicesRef.current = state.services;

  const callbacksRef = useRef<ProcessCallbacks>({
    onLog: (serviceName: string, log: LogEntry) => {
      if (isMountedRef.current) {
        dispatch({ type: 'APPEND_REAL_LOG', serviceName, log });
      }
    },
    onStatusChange: (serviceName: string, status, pid, error, statusText) => {
      if (isMountedRef.current) {
        dispatch({ type: 'PROCESS_STATUS_CHANGED', serviceName, status, pid, error, statusText });
      }
    }
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. Start all auto-start configured services on mount with pacing & concurrency settings
  useEffect(() => {
    if (!config || !config.services || config.services.length === 0) {
      return;
    }

    const controller = new AbortController();
    processManager.startAll(config.services, callbacksRef.current, config.settings, controller.signal)
      .catch(error => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Service startup orchestration failed: ${message}`);
        if (isMountedRef.current) {
          for (const service of config.services) {
            dispatch({
              type: 'PROCESS_STATUS_CHANGED',
              serviceName: service.name,
              status: 'warning',
              error: message,
              statusText: 'BOOT ERROR'
            });
          }
        }
      });

    return () => {
      controller.abort();
      processManager.stopAll().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to stop child services during cleanup: ${message}`);
      });
    };
  }, [config, dispatch]);

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
      const stopped = await processManager.stopService(service.name, callbacksRef.current);
      if (!stopped) {
        dispatch({
          type: 'PROCESS_STATUS_CHANGED',
          serviceName: service.name,
          status: 'warning',
          error: 'The service process did not stop',
          statusText: 'STOP TIMEOUT'
        });
      }
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
