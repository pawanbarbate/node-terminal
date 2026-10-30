export interface ServiceConfig {
  name: string;
  path: string;
  command: string | string[];
  commands?: string[];
  preStart?: string[];
  dependsOn?: string[];
  port?: number;
  autoStart?: boolean;
  readyPattern?: string;
}

export interface OrchestratorSettings {
  bootStaggerMs?: number;
  maxConcurrentBoot?: number;
}

export interface DevPulseConfig {
  $schema?: string;
  name?: string;
  version?: string;
  settings?: OrchestratorSettings;
  services: ServiceConfig[];
}

