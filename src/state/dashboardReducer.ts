import {
  ActivePanel,
  ActiveTab,
  NarrowTab,
  Service,
  ServiceStatus,
  WorkspaceSummary,
  LogEntry,
  DevPulseConfig
} from '../types/index.js';

const MAX_LOG_ENTRIES = 200;
const MAX_ERROR_ENTRIES = 100;

export const FILTER_OPTIONS = ['All Services'];

export interface DashboardState {
  selectedIndex: number;
  activeTab: ActiveTab;
  activePanel: ActivePanel;
  narrowTab: NarrowTab;
  time: string;
  uptimeSeconds: number;
  startedAt?: number;
  summary: WorkspaceSummary;
  services: Service[];
  restartingServiceId: string | null;
  globalLogs: LogEntry[];
  serviceLogScroll: number;
  globalLogScroll: number;
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
  time: new Date().toTimeString().slice(0, 8),
  uptimeSeconds: 0,
  summary: { servicesRunning: 0, servicesTotal: 0, uptime: '0m 0s' },
  services: [],
  restartingServiceId: null,
  globalLogs: [],
  serviceLogScroll: 0,
  globalLogScroll: 0,
  searchQuery: '',
  isSearching: false,
  filterIndex: 0,
  filterOptions: FILTER_OPTIONS,
  showHelp: false
};

export function configToServices(config?: DevPulseConfig): Service[] {
  if (!config?.services) return [];

  return config.services.map((s, idx) => ({
    id: `svc-${idx + 1}-${s.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: s.name,
    status: s.autoStart !== false ? 'starting' : 'stopped',
    statusText: s.autoStart !== false ? 'STARTING' : 'STOPPED',
    uptime: '0s',
    uptimeSeconds: 0,
    command: Array.isArray(s.command)
      ? s.command.join(' && ')
      : (s.command || (Array.isArray(s.commands) ? s.commands.join(' && ') : '')),
    path: s.path,
    port: s.port ? `:${s.port}` : '',
    pid: '-',
    errors: 0,
    rawConfig: s,
    logs: [],
    errorLogs: []
  }));
}

export function createInitialDashboardState(config?: DevPulseConfig): DashboardState {
  const services = configToServices(config);
  const filterOptions = config?.services && config.services.length > 0
    ? ['All Services', ...config.services.map(s => s.name)]
    : FILTER_OPTIONS.slice(0, 1);

  return {
    ...initialDashboardState,
    startedAt: Date.now(),
    services,
    globalLogs: [],
    filterOptions,
    summary: {
      servicesTotal: services.length,
      servicesRunning: 0,
      uptime: '0m 0s'
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
  | { type: 'START_RESTART_SERVICE'; index: number }
  | { type: 'TICK_CLOCK'; time: string }
  | { type: 'APPEND_REAL_LOG'; serviceName: string; log: LogEntry }
  | { type: 'PROCESS_STATUS_CHANGED'; serviceName: string; status: ServiceStatus; pid?: number; error?: string; statusText?: string };

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

    case 'TICK_CLOCK': {
      const now = Date.now();
      const nextUptime = state.startedAt
        ? Math.max(0, Math.floor((now - state.startedAt) / 1000))
        : state.uptimeSeconds + 1;
      const mins = Math.floor(nextUptime / 60);
      const secs = nextUptime % 60;
      const updatedServices = state.services.map(s => {
        if (s.status === 'running') {
          const u = s.startedAt
            ? Math.max(0, Math.floor((now - s.startedAt) / 1000))
            : (s.uptimeSeconds || 0) + 1;
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
        summary: {
          ...state.summary,
          uptime: `${mins}m ${secs}s`
        }
      };
    }

    case 'APPEND_REAL_LOG': {
      const nextGlobal = [...state.globalLogs.slice(-(MAX_LOG_ENTRIES - 1)), action.log];
      const isError = action.log.level === 'error' || action.log.level === 'ERROR';

      const nextServices = state.services.map(s => {
        if (s.name.toLowerCase() === action.serviceName.toLowerCase()) {
          const nextLogs = [...(s.logs || []).slice(-(MAX_LOG_ENTRIES - 1)), action.log];
          const nextErrors = isError
            ? [...(s.errorLogs || []).slice(-(MAX_ERROR_ENTRIES - 1)), action.log]
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
          const startedAt = isNowRunning
            ? (wasRunning ? (s.startedAt || Date.now()) : Date.now())
            : undefined;
          return {
            ...s,
            status: action.status,
            statusText: action.statusText || action.status.toUpperCase(),
            pid: action.pid ? String(action.pid) : (action.status === 'stopped' ? '-' : s.pid),
            startedAt,
            uptime: isNowRunning ? (wasRunning ? s.uptime : '0s') : '0s',
            uptimeSeconds: isNowRunning ? (wasRunning ? (s.uptimeSeconds || 0) : 0) : 0,
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
        summary: {
          ...state.summary,
          servicesRunning: runningCount,
          servicesTotal: nextServices.length
        }
      };
    }

    default:
      return state;
  }
}
