import {
  ActivePanel,
  ActiveTab,
  NarrowTab,
  Service,
  ServiceStatus,
  SystemMetrics,
  LogEntry,
  DevPulseConfig
} from '../types/index.js';
import {
  INITIAL_SERVICES,
  INITIAL_GLOBAL_LOGS,
  INITIAL_SYSTEM_METRICS
} from '../data/mockData.js';

export const FILTER_OPTIONS = [
  'All Services',
  'AUTH',
  'USER',
  'PAYMENT',
  'NOTIF',
  'GATEWAY',
  'WORKER'
];

export interface DashboardState {
  selectedIndex: number;
  activeTab: ActiveTab;
  activePanel: ActivePanel;
  narrowTab: NarrowTab;
  time: string;
  uptimeSeconds: number;
  metrics: SystemMetrics;
  services: Service[];
  restartingServiceId: string | null;
  globalLogs: LogEntry[];
  serviceLogScroll: number;
  globalLogScroll: number;
  isLive: boolean;
  searchQuery: string;
  isSearching: boolean;
  filterIndex: number;
  filterOptions: string[];
  showHelp: boolean;
}

export const initialDashboardState: DashboardState = {
  selectedIndex: 0,
  activeTab: 'logs',
  activePanel: 'services',
  narrowTab: 'services',
  time: '10:24:17',
  uptimeSeconds: 754,
  metrics: INITIAL_SYSTEM_METRICS,
  services: INITIAL_SERVICES,
  restartingServiceId: null,
  globalLogs: INITIAL_GLOBAL_LOGS,
  serviceLogScroll: 0,
  globalLogScroll: 0,
  isLive: true,
  searchQuery: '',
  isSearching: false,
  filterIndex: 0,
  filterOptions: FILTER_OPTIONS,
  showHelp: false
};

export function configToServices(config?: DevPulseConfig): Service[] {
  if (!config || !config.services || config.services.length === 0) {
    return INITIAL_SERVICES;
  }

  return config.services.map((s, idx) => ({
    id: `svc-${idx + 1}-${s.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: s.name,
    status: s.autoStart !== false ? 'starting' : 'stopped',
    statusText: s.autoStart !== false ? 'STARTING' : 'STOPPED',
    uptime: '0s',
    uptimeSeconds: 0,
    command: s.command,
    path: s.path,
    port: s.port ? `:${s.port}` : ':3000',
    pid: '-',
    errors: 0,
    rawConfig: s,
    metrics: {
      cpu: '0%',
      memory: '0 MB',
      p50: '0 ms',
      p99: '0 ms',
      requests: '0 req/min'
    },
    env: s.envFile ? [{ key: 'ENV_FILE', value: s.envFile }] : [],
    logs: [],
    errorLogs: []
  }));
}

export function createInitialDashboardState(config?: DevPulseConfig): DashboardState {
  const services = configToServices(config);
  const filterOptions = config?.services && config.services.length > 0
    ? ['All Services', ...config.services.map(s => s.name)]
    : FILTER_OPTIONS;

  return {
    ...initialDashboardState,
    services,
    globalLogs: config?.services && config.services.length > 0 ? [] : INITIAL_GLOBAL_LOGS,
    filterOptions,
    metrics: {
      ...INITIAL_SYSTEM_METRICS,
      servicesTotal: services.length,
      servicesRunning: 0
    }
  };
}

export type DashboardAction =
  | { type: 'SELECT_SERVICE'; index: number }
  | { type: 'NAVIGATE_SERVICES'; delta: number }
  | { type: 'SET_ACTIVE_PANEL'; panel: ActivePanel }
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_NARROW_TAB'; tab: NarrowTab }
  | { type: 'CYCLE_PANEL' }
  | { type: 'SCROLL_SERVICE_LOGS'; delta: number; maxScroll?: number }
  | { type: 'SET_SERVICE_LOG_SCROLL'; value: number; maxScroll?: number }
  | { type: 'SCROLL_GLOBAL_LOGS'; delta: number; maxScroll?: number }
  | { type: 'SET_GLOBAL_LOG_SCROLL'; value: number; maxScroll?: number }
  | { type: 'TOGGLE_HELP'; show?: boolean }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'APPEND_SEARCH_CHAR'; char: string }
  | { type: 'POP_SEARCH_CHAR' }
  | { type: 'SET_SEARCHING'; isSearching: boolean }
  | { type: 'CYCLE_FILTER' }
  | { type: 'SET_FILTER_INDEX'; index: number }
  | { type: 'TOGGLE_LIVE' }
  | { type: 'START_RESTART_SERVICE'; index: number }
  | { type: 'FINISH_RESTART_SERVICE'; index: number }
  | { type: 'TOGGLE_STOP_SERVICE'; index: number }
  | { type: 'TICK_CLOCK'; time: string; cpuChange: number }
  | { type: 'APPEND_GLOBAL_LOG'; log: LogEntry; timeStr: string }
  | { type: 'APPEND_REAL_LOG'; serviceName: string; log: LogEntry }
  | { type: 'PROCESS_STATUS_CHANGED'; serviceName: string; status: ServiceStatus; pid?: number; error?: string }
  | { type: 'UPDATE_SERVICE_METRICS'; metrics: Record<string, { cpu?: string; memory?: string }> };

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SELECT_SERVICE': {
      const clamped = Math.max(0, Math.min(state.services.length - 1, action.index));
      return {
        ...state,
        selectedIndex: clamped,
        activePanel: 'services',
        serviceLogScroll: 0
      };
    }

    case 'NAVIGATE_SERVICES': {
      const nextIndex = Math.max(0, Math.min(state.services.length - 1, state.selectedIndex + action.delta));
      return {
        ...state,
        selectedIndex: nextIndex,
        activePanel: 'services',
        serviceLogScroll: 0
      };
    }

    case 'SET_ACTIVE_PANEL':
      return {
        ...state,
        activePanel: action.panel
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.tab,
        activePanel: 'serviceLogs',
        serviceLogScroll: 0
      };

    case 'SET_NARROW_TAB':
      return {
        ...state,
        narrowTab: action.tab,
        activePanel: action.tab === 'services' ? 'services' : action.tab === 'detail' ? 'serviceLogs' : 'globalLogs'
      };

    case 'CYCLE_PANEL': {
      let nextPanel: ActivePanel = 'services';
      if (state.activePanel === 'services') nextPanel = 'serviceLogs';
      else if (state.activePanel === 'serviceLogs') nextPanel = 'globalLogs';
      return {
        ...state,
        activePanel: nextPanel
      };
    }

    case 'SCROLL_SERVICE_LOGS': {
      const selectedService = state.services[state.selectedIndex];
      const totalLogs = selectedService?.logs?.length || 0;
      const maxScroll = action.maxScroll !== undefined 
        ? Math.max(0, action.maxScroll) 
        : Math.max(0, totalLogs);

      const baseScroll = state.serviceLogScroll > maxScroll 
        ? maxScroll 
        : state.serviceLogScroll;
      const nextScroll = Math.max(0, Math.min(maxScroll, baseScroll + action.delta));

      return {
        ...state,
        serviceLogScroll: nextScroll
      };
    }

    case 'SET_SERVICE_LOG_SCROLL': {
      const selectedService = state.services[state.selectedIndex];
      const totalLogs = selectedService?.logs?.length || 0;
      const maxScroll = action.maxScroll !== undefined 
        ? Math.max(0, action.maxScroll) 
        : Math.max(0, totalLogs);

      return {
        ...state,
        serviceLogScroll: Math.max(0, Math.min(maxScroll, action.value))
      };
    }

    case 'SCROLL_GLOBAL_LOGS': {
      const totalLogs = state.globalLogs.length;
      const maxScroll = action.maxScroll !== undefined 
        ? Math.max(0, action.maxScroll) 
        : Math.max(0, totalLogs);

      const baseScroll = state.globalLogScroll > maxScroll 
        ? maxScroll 
        : state.globalLogScroll;
      const nextScroll = Math.max(0, Math.min(maxScroll, baseScroll + action.delta));

      return {
        ...state,
        globalLogScroll: nextScroll
      };
    }

    case 'SET_GLOBAL_LOG_SCROLL': {
      const totalLogs = state.globalLogs.length;
      const maxScroll = action.maxScroll !== undefined 
        ? Math.max(0, action.maxScroll) 
        : Math.max(0, totalLogs);

      return {
        ...state,
        globalLogScroll: Math.max(0, Math.min(maxScroll, action.value))
      };
    }

    case 'TOGGLE_HELP':
      return {
        ...state,
        showHelp: action.show !== undefined ? action.show : !state.showHelp
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.query
      };

    case 'APPEND_SEARCH_CHAR':
      return {
        ...state,
        searchQuery: state.searchQuery + action.char
      };

    case 'POP_SEARCH_CHAR':
      return {
        ...state,
        searchQuery: state.searchQuery.slice(0, -1)
      };

    case 'SET_SEARCHING':
      return {
        ...state,
        isSearching: action.isSearching
      };

    case 'CYCLE_FILTER':
      return {
        ...state,
        filterIndex: (state.filterIndex + 1) % state.filterOptions.length
      };

    case 'SET_FILTER_INDEX':
      return {
        ...state,
        filterIndex: action.index
      };

    case 'TOGGLE_LIVE':
      return {
        ...state,
        isLive: !state.isLive
      };

    case 'START_RESTART_SERVICE': {
      const target = state.services[action.index];
      if (!target) return state;
      return {
        ...state,
        restartingServiceId: target.id,
        services: state.services.map((s, i) =>
          i === action.index ? { ...s, status: 'starting', statusText: 'STARTING' } : s
        )
      };
    }

    case 'FINISH_RESTART_SERVICE':
      return {
        ...state,
        restartingServiceId: null,
        services: state.services.map((s, i) =>
          i === action.index ? { ...s, status: 'running', statusText: 'RUNNING' } : s
        )
      };

    case 'TOGGLE_STOP_SERVICE':
      return {
        ...state,
        services: state.services.map((s, i) =>
          i === action.index
            ? {
                ...s,
                status: s.status === 'running' ? 'stopped' : 'starting',
                statusText: s.status === 'running' ? 'STOPPED' : 'STARTING'
              }
            : s
        )
      };

    case 'TICK_CLOCK': {
      const nextUptime = state.uptimeSeconds + 1;
      const mins = Math.floor(nextUptime / 60);
      const secs = nextUptime % 60;
      const newCpu = Math.min(48, Math.max(12, state.metrics.cpu + action.cpuChange));

      const updatedServices = state.services.map(s => {
        if (s.status === 'running') {
          const u = (s.uptimeSeconds || 0) + 1;
          const m = Math.floor(u / 60);
          const sc = u % 60;
          return {
            ...s,
            uptimeSeconds: u,
            uptime: m > 0 ? `${m}m ${sc}s` : `${sc}s`
          };
        }
        return s;
      });

      return {
        ...state,
        time: action.time,
        uptimeSeconds: nextUptime,
        services: updatedServices,
        metrics: {
          ...state.metrics,
          uptime: `${mins}m ${secs}s`,
          cpu: newCpu
        }
      };
    }

    case 'APPEND_REAL_LOG': {
      const nextGlobal = [...state.globalLogs.slice(-200), action.log];
      const isError = action.log.level === 'error' || action.log.level === 'ERROR';

      const nextServices = state.services.map(s => {
        if (s.name.toLowerCase() === action.serviceName.toLowerCase()) {
          const nextLogs = [...(s.logs || []).slice(-200), action.log];
          const nextErrors = isError
            ? [...(s.errorLogs || []).slice(-100), action.log]
            : (s.errorLogs || []);
          return {
            ...s,
            logs: nextLogs,
            errorLogs: nextErrors,
            errors: s.errors + (isError ? 1 : 0)
          };
        }
        return s;
      });

      return {
        ...state,
        globalLogs: nextGlobal,
        services: nextServices
      };
    }

    case 'PROCESS_STATUS_CHANGED': {
      const nextServices = state.services.map(s => {
        if (s.name.toLowerCase() === action.serviceName.toLowerCase()) {
          const isNowRunning = action.status === 'running';
          const wasRunning = s.status === 'running';
          return {
            ...s,
            status: action.status,
            statusText: action.status.toUpperCase(),
            pid: action.pid ? String(action.pid) : (action.status === 'stopped' ? '-' : s.pid),
            uptime: isNowRunning ? (wasRunning ? s.uptime : '0s') : '0s',
            uptimeSeconds: isNowRunning ? (wasRunning ? s.uptimeSeconds : 0) : 0,
            restartingServiceId: action.status === 'running' && state.restartingServiceId === s.id
              ? null
              : state.restartingServiceId
          };
        }
        return s;
      });

      const runningCount = nextServices.filter(s => s.status === 'running').length;
      return {
        ...state,
        restartingServiceId: action.status === 'running' ? null : state.restartingServiceId,
        services: nextServices,
        metrics: {
          ...state.metrics,
          servicesRunning: runningCount
        }
      };
    }

    case 'UPDATE_SERVICE_METRICS': {
      const nextServices = state.services.map(s => {
        const m = action.metrics[s.name];
        if (m) {
          return {
            ...s,
            metrics: {
              ...s.metrics,
              cpu: m.cpu || s.metrics?.cpu,
              memory: m.memory || s.metrics?.memory
            }
          };
        }
        return s;
      });

      return {
        ...state,
        services: nextServices
      };
    }

    case 'APPEND_GLOBAL_LOG': {
      const nextGlobal = [...state.globalLogs.slice(-30), action.log];
      const nextServices = state.services.map(s => {
        if (s.name.toUpperCase().includes(action.log.service.toUpperCase())) {
          return {
            ...s,
            logs: [...(s.logs || []).slice(-25), {
              id: `${action.log.id}-s`,
              timestamp: action.timeStr,
              service: action.log.service,
              level: action.log.level,
              message: action.log.message
            }]
          };
        }
        return s;
      });

      return {
        ...state,
        globalLogs: nextGlobal,
        services: nextServices
      };
    }

    default:
      return state;
  }
}

