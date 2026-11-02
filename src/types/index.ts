import { ServiceConfig } from './config.js';

export type ServiceStatus = 'running' | 'stopped' | 'starting' | 'warning' | 'waiting' | 'blocked';

export type ActivePanel = 'services' | 'serviceLogs' | 'globalLogs';

export type ActiveTab = 'logs' | 'errors' | 'process';

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

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  statusText?: string;
  uptime: string;
  uptimeSeconds?: number;
  startedAt?: number;
  command: string;
  path?: string;
  port: string;
  pid: string;
  errors: number;
  logs?: LogEntry[];
  errorLogs?: LogEntry[];
  rawConfig?: ServiceConfig;
}

export interface ProcessCallbacks {
  onLog: (serviceName: string, log: LogEntry) => void;
  onStatusChange: (serviceName: string, status: ServiceStatus, pid?: number, error?: string, statusText?: string) => void;
}

export interface WorkspaceSummary {
  servicesRunning: number;
  servicesTotal: number;
  uptime: string;
}

export interface ViewportInfo {
  width: number;
  height: number;
  isWide: boolean;
  isUltraNarrow: boolean;
  isTooSmall: boolean;
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
