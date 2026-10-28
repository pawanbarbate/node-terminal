export interface ServiceConfig {
  name: string;
  path: string;
  command: string | string[];
  commands?: string[];
  preStart?: string[];
  dependsOn?: string[];
  port?: number;
  autoStart?: boolean;
  envFile?: string;
  readyPattern?: string;
}

export interface DevPulseConfig {
  $schema?: string;
  name?: string;
  version?: string;
  services: ServiceConfig[];
}

