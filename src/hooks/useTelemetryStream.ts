import React, { useEffect } from 'react';
import { DashboardAction } from '../state/dashboardReducer.js';
import { LogEntry } from '../types/index.js';

const LOG_CANDIDATES = [
  { service: 'AUTH', color: '#1e40af', msg: 'POST /api/auth/refresh 200 (18 ms)', level: 'info' as const },
  { service: 'USER', color: '#065f46', msg: 'User profile updated (34 ms)', level: 'info' as const },
  { service: 'PAYMENT', color: '#991b1b', msg: '✖ Stripe API error: Invalid API key', level: 'error' as const },
  { service: 'PAYMENT', color: '#991b1b', msg: 'Retrying in 5 seconds...', level: 'warn' as const },
  { service: 'GATEWAY', color: '#92400e', msg: 'Proxying request to user-service', level: 'info' as const },
  { service: 'NOTIF', color: '#0369a1', msg: 'Push notification sent to iOS device', level: 'info' as const },
  { service: 'WORKER', color: '#0f766e', msg: 'Processing job: send-digest-email', level: 'info' as const },
  { service: 'AUTH', color: '#1e40af', msg: 'GET /api/auth/session 200 (14 ms)', level: 'info' as const }
];

export function useTelemetryStream(
  isLive: boolean,
  dispatch: React.Dispatch<DashboardAction>
) {
  // 1. Clock & Metric oscillation (1s)
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

  // 2. Simulated log stream (2.8s)
  useEffect(() => {
    if (!isLive) return;

    const streamInterval = setInterval(() => {
      const pick = LOG_CANDIDATES[Math.floor(Math.random() * LOG_CANDIDATES.length)];
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hh}:${mm}:${ss}`;

      const newLog: LogEntry = {
        id: Date.now() + Math.random(),
        timestamp: timeStr,
        service: pick.service,
        serviceColor: pick.color,
        message: pick.msg,
        level: pick.level
      };

      dispatch({
        type: 'APPEND_GLOBAL_LOG',
        log: newLog,
        timeStr
      });
    }, 2800);

    return () => clearInterval(streamInterval);
  }, [isLive, dispatch]);
}

