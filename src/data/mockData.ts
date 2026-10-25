import { Service, LogEntry, SystemMetrics } from '../types/index.js';

export const INITIAL_SERVICES: Service[] = [
  {
    id: 'auth',
    name: 'auth-service',
    status: 'running',
    statusText: 'RUNNING',
    uptime: '12s',
    uptimeSeconds: 12,
    command: 'npm run auth',
    port: ':3001',
    pid: '48231',
    errors: 0,
    metrics: {
      cpu: '14%',
      memory: '142 MB',
      p50: '18 ms',
      p99: '45 ms',
      requests: '142 req/min'
    },
    env: [
      { key: 'PORT', value: '3001' },
      { key: 'NODE_ENV', value: 'development' },
      { key: 'DB_HOST', value: 'localhost:5432' },
      { key: 'REDIS_HOST', value: 'localhost:6379' },
      { key: 'JWT_SECRET', value: '••••••••••••••••' },
      { key: 'LOG_LEVEL', value: 'debug' }
    ],
    logs: [
      { id: 'a-1', timestamp: '10:24:01', level: 'INFO', service: 'AUTH', message: 'Starting auth service...' },
      { id: 'a-2', timestamp: '10:24:02', level: 'INFO', service: 'AUTH', message: 'Loading environment variables' },
      { id: 'a-3', timestamp: '10:24:02', level: 'INFO', service: 'AUTH', message: 'Connecting to database...' },
      { id: 'a-4', timestamp: '10:24:03', level: 'INFO', service: 'AUTH', message: 'Database connected  (32 ms)' },
      { id: 'a-5', timestamp: '10:24:03', level: 'INFO', service: 'AUTH', message: 'Redis connected  (12 ms)' },
      { id: 'a-6', timestamp: '10:24:04', level: 'INFO', service: 'AUTH', message: 'JWT secret loaded' },
      { id: 'a-7', timestamp: '10:24:04', level: 'INFO', service: 'AUTH', message: 'Auth middleware initialized' },
      { id: 'a-8', timestamp: '10:24:05', level: 'INFO', service: 'AUTH', message: 'Routes registered  (8 routes)' },
      { id: 'a-9', timestamp: '10:24:05', level: 'INFO', service: 'AUTH', message: 'Server listening on http://localhost:3001' },
      { id: 'a-10', timestamp: '10:24:06', level: 'INFO', service: 'AUTH', message: 'Health check passed' },
      { id: 'a-11', timestamp: '10:24:12', level: 'INFO', service: 'AUTH', message: 'POST /api/auth/login  200  (45 ms)' },
      { id: 'a-12', timestamp: '10:24:15', level: 'INFO', service: 'AUTH', message: 'GET /api/auth/me      200  (12 ms)' }
    ],
    errorLogs: []
  },
  {
    id: 'user',
    name: 'user-service',
    status: 'running',
    statusText: 'RUNNING',
    uptime: '12s',
    uptimeSeconds: 12,
    command: 'npm run user',
    port: ':3002',
    pid: '48235',
    errors: 0,
    metrics: {
      cpu: '8%',
      memory: '118 MB',
      p50: '24 ms',
      p99: '60 ms',
      requests: '98 req/min'
    },
    env: [
      { key: 'PORT', value: '3002' },
      { key: 'NODE_ENV', value: 'development' },
      { key: 'USER_DB_NAME', value: 'users_dev' },
      { key: 'CACHE_TTL', value: '3600' }
    ],
    logs: [
      { id: 'u-1', timestamp: '10:24:00', level: 'INFO', service: 'USER', message: 'Starting user service on port 3002...' },
      { id: 'u-2', timestamp: '10:24:02', level: 'INFO', service: 'USER', message: 'Database connection established' },
      { id: 'u-3', timestamp: '10:24:04', level: 'INFO', service: 'USER', message: 'Cache client warmed up' },
      { id: 'u-4', timestamp: '10:24:06', level: 'INFO', service: 'USER', message: 'User repository initialized' },
      { id: 'u-5', timestamp: '10:24:10', level: 'INFO', service: 'USER', message: 'Server listening on http://localhost:3002' },
      { id: 'u-6', timestamp: '10:24:14', level: 'INFO', service: 'USER', message: 'User profile fetched  (28 ms)' }
    ],
    errorLogs: []
  },
  {
    id: 'payment',
    name: 'payment-service',
    status: 'stopped',
    statusText: 'STOPPED',
    uptime: '2m',
    uptimeSeconds: 120,
    command: 'npm run payment',
    port: ':3003',
    pid: '48239',
    errors: 1,
    metrics: {
      cpu: '0%',
      memory: '0 MB',
      p50: '0 ms',
      p99: '0 ms',
      requests: '0 req/min'
    },
    env: [
      { key: 'PORT', value: '3003' },
      { key: 'STRIPE_KEY', value: 'sk_test_••••••••' },
      { key: 'WEBHOOK_SECRET', value: 'whsec_••••••••' }
    ],
    logs: [
      { id: 'p-1', timestamp: '10:24:01', level: 'INFO', service: 'PAYMENT', message: 'Starting payment service...' },
      { id: 'p-2', timestamp: '10:24:03', level: 'INFO', service: 'PAYMENT', message: 'Initializing Stripe SDK...' },
      { id: 'p-3', timestamp: '10:24:08', level: 'WARN', service: 'PAYMENT', message: 'Retrying in 5 seconds...' },
      { id: 'p-4', timestamp: '10:24:13', level: 'ERROR', service: 'PAYMENT', message: '✖ Stripe API error: Invalid API key' }
    ],
    errorLogs: [
      {
        id: 'pe-1',
        timestamp: '10:24:13',
        level: 'ERROR',
        service: 'PAYMENT',
        message: '✖ Stripe API error: Invalid API key (Code: 401 Unauthorized)'
      }
    ]
  },
  {
    id: 'notification',
    name: 'notification',
    status: 'running',
    statusText: 'RUNNING',
    uptime: '12s',
    uptimeSeconds: 12,
    command: 'npm run notification',
    port: ':3004',
    pid: '48242',
    errors: 0,
    metrics: {
      cpu: '5%',
      memory: '96 MB',
      p50: '12 ms',
      p99: '32 ms',
      requests: '64 req/min'
    },
    env: [
      { key: 'PORT', value: '3004' },
      { key: 'SMTP_HOST', value: 'mail.smtp.internal' },
      { key: 'QUEUE_NAME', value: 'notifications_queue' }
    ],
    logs: [
      { id: 'n-1', timestamp: '10:24:02', level: 'INFO', service: 'NOTIF', message: 'Notification daemon initialized' },
      { id: 'n-2', timestamp: '10:24:04', level: 'INFO', service: 'NOTIF', message: 'Connecting to message broker...' },
      { id: 'n-3', timestamp: '10:24:06', level: 'INFO', service: 'NOTIF', message: 'Broker connected' },
      { id: 'n-4', timestamp: '10:24:08', level: 'INFO', service: 'NOTIF', message: 'Listening on port 3004' },
      { id: 'n-5', timestamp: '10:24:12', level: 'INFO', service: 'NOTIF', message: 'Email sent to user@example.com' }
    ],
    errorLogs: []
  },
  {
    id: 'gateway',
    name: 'gateway',
    status: 'warning',
    statusText: 'STARTING',
    uptime: '45s',
    uptimeSeconds: 45,
    command: 'npm run gateway',
    port: ':3000',
    pid: '48220',
    errors: 0,
    metrics: {
      cpu: '18%',
      memory: '160 MB',
      p50: '5 ms',
      p99: '16 ms',
      requests: '320 req/min'
    },
    env: [
      { key: 'PORT', value: '3000' },
      { key: 'PROXY_TIMEOUT', value: '5000' },
      { key: 'RATE_LIMIT', value: '1000' }
    ],
    logs: [
      { id: 'gw-1', timestamp: '10:23:40', level: 'INFO', service: 'GATEWAY', message: 'API Gateway booting up...' },
      { id: 'gw-2', timestamp: '10:23:45', level: 'INFO', service: 'GATEWAY', message: 'Loading upstream reverse proxies' },
      { id: 'gw-3', timestamp: '10:23:50', level: 'INFO', service: 'GATEWAY', message: 'Registered proxy routes for 6 services' },
      { id: 'gw-4', timestamp: '10:24:00', level: 'INFO', service: 'GATEWAY', message: 'Server listening on http://localhost:3000' },
      { id: 'gw-5', timestamp: '10:24:11', level: 'INFO', service: 'GATEWAY', message: 'Proxying request to auth-service' }
    ],
    errorLogs: []
  },
  {
    id: 'worker',
    name: 'worker',
    status: 'running',
    statusText: 'RUNNING',
    uptime: '5m',
    uptimeSeconds: 300,
    command: 'npm run worker',
    port: ':3005',
    pid: '48248',
    errors: 0,
    metrics: {
      cpu: '22%',
      memory: '210 MB',
      p50: '45 ms',
      p99: '180 ms',
      requests: '52 jobs/min'
    },
    env: [
      { key: 'PORT', value: '3005' },
      { key: 'CONCURRENCY', value: '10' },
      { key: 'REDIS_QUEUE_URL', value: 'redis://localhost:6379/1' }
    ],
    logs: [
      { id: 'wk-1', timestamp: '10:19:15', level: 'INFO', service: 'WORKER', message: 'Background worker cluster initialized' },
      { id: 'wk-2', timestamp: '10:19:16', level: 'INFO', service: 'WORKER', message: 'Concurrency set to 10 workers' },
      { id: 'wk-3', timestamp: '10:20:00', level: 'INFO', service: 'WORKER', message: 'Queue poll active' },
      { id: 'wk-4', timestamp: '10:24:09', level: 'INFO', service: 'WORKER', message: 'Processing job: send-welcome-email' }
    ],
    errorLogs: []
  }
];

export const INITIAL_GLOBAL_LOGS: LogEntry[] = [
  {
    id: 'g-1',
    timestamp: '17:43:27',
    service: 'WORKER',
    serviceColor: '#0f766e',
    level: 'info',
    message: 'Processing job: send-digest-email'
  },
  {
    id: 'g-2',
    timestamp: '17:43:23',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'GET /api/auth/session  200  (14 ms)'
  },
  {
    id: 'g-3',
    timestamp: '17:43:14',
    service: 'GATEWAY',
    serviceColor: '#92400e',
    level: 'info',
    message: 'Proxying request to user-service'
  },
  {
    id: 'g-4',
    timestamp: '17:43:09',
    service: 'WORKER',
    serviceColor: '#0f766e',
    level: 'info',
    message: 'Processing job: send-digest-email'
  },
  {
    id: 'g-5',
    timestamp: '17:43:05',
    service: 'USER',
    serviceColor: '#065f46',
    level: 'info',
    message: 'User profile updated  (34 ms)'
  },
  {
    id: 'g-6',
    timestamp: '17:43:00',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'GET /api/auth/session  200  (14 ms)'
  },
  {
    id: 'g-7',
    timestamp: '17:42:56',
    service: 'USER',
    serviceColor: '#065f46',
    level: 'info',
    message: 'User profile updated  (34 ms)'
  },
  {
    id: 'g-8',
    timestamp: '17:42:51',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'GET /api/auth/session  200  (14 ms)'
  },
  {
    id: 'g-9',
    timestamp: '17:42:47',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'GET /api/auth/session  200  (14 ms)'
  },
  {
    id: 'g-10',
    timestamp: '17:42:42',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'GET /api/auth/session  200  (14 ms)'
  },
  {
    id: 'g-11',
    timestamp: '17:42:38',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'POST /api/auth/refresh  200  (18 ms)'
  },
  {
    id: 'g-12',
    timestamp: '17:42:33',
    service: 'GATEWAY',
    serviceColor: '#92400e',
    level: 'info',
    message: 'Proxying request to user-service'
  },
  {
    id: 'g-13',
    timestamp: '17:42:29',
    service: 'NOTIF',
    serviceColor: '#0369a1',
    level: 'info',
    message: 'Push notification sent to iOS device'
  },
  {
    id: 'g-14',
    timestamp: '17:42:24',
    service: 'GATEWAY',
    serviceColor: '#92400e',
    level: 'info',
    message: 'Proxying request to user-service'
  },
  {
    id: 'g-15',
    timestamp: '17:42:20',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'POST /api/auth/refresh  200  (18 ms)'
  },
  {
    id: 'g-16',
    timestamp: '10:24:13',
    service: 'PAYMENT',
    serviceColor: '#991b1b',
    level: 'error',
    message: '✖ Stripe API error: Invalid API key'
  },
  {
    id: 'g-17',
    timestamp: '10:24:08',
    service: 'PAYMENT',
    serviceColor: '#991b1b',
    level: 'warn',
    message: 'Retrying in 5 seconds...'
  },
  {
    id: 'g-18',
    timestamp: '10:24:05',
    service: 'AUTH',
    serviceColor: '#1e40af',
    level: 'info',
    message: 'Server listening on http://localhost:3001'
  }
];

export const SERVICE_COLORS: Record<string, string> = {
  AUTH: '#1e40af',
  USER: '#065f46',
  PAYMENT: '#991b1b',
  NOTIF: '#0369a1',
  GATEWAY: '#92400e',
  WORKER: '#0f766e'
};

export const INITIAL_SYSTEM_METRICS: SystemMetrics = {
  cpu: 32,
  memoryUsed: 1.2,
  memoryTotal: 4.0,
  servicesRunning: 5,
  servicesTotal: 6,
  uptime: '12m 34s',
  errors1h: 3
};

