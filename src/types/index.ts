import { ServiceConfig } from './config.js';

export type ServiceStatus = 'running' | 'stopped' | 'starting' | 'warning';

export type ActivePanel = 'services' | 'serviceLogs' | 'globalLogs';

export type ActiveTab = 'logs' | 'errors' | 'metrics' | 'env';

export type NarrowTab = 'services' | 'detail' | 'logs';

export type FilterOption =
  | 'All Services'
  | 'AUTH'
  | 'USER'
  | 'PAYMENT'
  | 'NOTIF'
  | 'GATEWAY'
  | 'WORKER'
  | string;

export interface LogEntry {
  id: string | number;
  timestamp: string;
  service: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'INFO' | 'WARN' | 'ERROR';
  serviceColor?: string;
}

export interface ServiceMetrics {
  cpu?: string;
  memory?: string;
  p50?: string;
  p99?: string;
  requests?: string;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  statusText?: string;
  uptime: string;
  uptimeSeconds?: number;
  command: string;
  path?: string;
  port: string;
  pid: string;
  errors: number;
  metrics?: ServiceMetrics;
  env?: EnvVar[];
  logs?: LogEntry[];
  errorLogs?: LogEntry[];
  rawConfig?: ServiceConfig;
}

export interface ProcessCallbacks {
  onLog: (serviceName: string, log: LogEntry) => void;
  onStatusChange: (serviceName: string, status: ServiceStatus, pid?: number, error?: string) => void;
}

export interface SystemMetrics {
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  servicesRunning: number;
  servicesTotal: number;
  uptime: string;
  errors1h: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  isWide: boolean;
  isUltraNarrow: boolean;
  isCompactHeight: boolean;
  isUltraCompactHeight: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  contentHeight: number;
  servicesPanelHeight: number;
  systemPanelHeight: number;
  detailPanelHeight: number;
  globalLogsPanelHeight: number;
  maxServiceLogs: number;
  maxGlobalLogs: number;
}

export interface SgrMouseEvent {
  button: number;
  baseButton: number;
  x: number;
  y: number;
  isPress: boolean;
  isRelease: boolean;
  isWheelUp: boolean;
  isWheelDown: boolean;
}

export * from './config.js';

