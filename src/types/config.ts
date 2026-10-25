export interface ServiceConfig {
  name: string;
  path: string;
  command: string;
  port?: number;
  autoStart?: boolean;
  envFile?: string;
}

export interface DevPulseConfig {
  $schema?: string;
  name?: string;
  version?: string;
  services: ServiceConfig[];
}

