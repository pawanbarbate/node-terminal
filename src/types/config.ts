export const CONFIG_SCHEMA_URL =
  'https://raw.githubusercontent.com/pawanbarbate/node-terminal/main/schema/devpulse.schema.json';

export interface ServiceConfig {
  name: string;
  path: string;
  command?: string | string[];
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
