import React, { useRef } from 'react';
import { useInput } from 'ink';
import { DashboardState, DashboardAction, FILTER_OPTIONS } from '../state/dashboardReducer.js';
import { ViewportInfo } from '../types/index.js';
import { ClickManagerContextValue } from '../components/common/ClickManager.js';

interface UseTerminalInputProps {
  state: DashboardState;
  viewport: ViewportInfo;
  dispatch: React.Dispatch<DashboardAction>;
  exit: () => void;
  clickManagerRef?: React.RefObject<ClickManagerContextValue | null>;
  onRestart?: (index: number) => void;
  onToggleStop?: (index: number) => void;
}

export function useTerminalInput({
  state,
  viewport,
  dispatch,
  exit,
  clickManagerRef,
  onRestart,
  onToggleStop
}: UseTerminalInputProps) {
  const lastServiceNavTimeRef = useRef(0);
  const lastLogScrollTimeRef = useRef(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const onRestartRef = useRef(onRestart);
  onRestartRef.current = onRestart;

  const onToggleStopRef = useRef(onToggleStop);
  onToggleStopRef.current = onToggleStop;

  useInput((input, key) => {
    // -------------------------------------------------------------
    // 1. SGR Mouse Reporting Parser: [<button;x;yM or \x1b[<... or <...
    // -------------------------------------------------------------
    if (
      input &&
      (input.includes('[<') ||
        input.includes('\x1b[<') ||
        /\[?<\d+;\d+;\d+[Mm]/.test(input) ||
        input.includes('<64;') ||
        input.includes('<65;'))
    ) {
      const sgrRegex = /(?:\x1b)?\[?<(\d+);(\d+);(\d+)([Mm])/g;
      let match: RegExpExecArray | null;
      let processedMouse = false;

      while ((match = sgrRegex.exec(input)) !== null) {
        processedMouse = true;
        const button = parseInt(match[1] || '0', 10);
        const mouseX = parseInt(match[2] || '0', 10);
        const mouseY = parseInt(match[3] || '0', 10);
        const isPress = match[4] === 'M';

        // Strip modifier flags: Shift (+4), Meta/Alt (+8), Ctrl (+16) = 28
        const baseButton = button & ~28;

        // 1a. Left Click (Base Button 0 press)
        if (baseButton === 0 && isPress) {
          // First attempt dynamic dispatch to any registered <Clickable> component
          const wasHandled = clickManagerRef?.current?.dispatchClick(mouseX, mouseY);
          if (!wasHandled) {
            // Fallback: panel focus based on column/region
            if (mouseX <= viewport.leftPanelWidth + 1) {
              dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'services' });
            } else {
              const detailEndRow = 1 + viewport.detailPanelHeight;
              if (mouseY <= detailEndRow) {
                dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'serviceLogs' });
              } else {
                dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'globalLogs' });
              }
            }
          }
        }

        // 1b. Mouse Wheel UP (Base Button 64)
        const isWheelUp = baseButton === 64;
        if (isWheelUp) {
          const now = Date.now();
          if (mouseX <= viewport.leftPanelWidth + 1) {
            if (now - lastServiceNavTimeRef.current >= 75) {
              lastServiceNavTimeRef.current = now;
              dispatch({ type: 'NAVIGATE_SERVICES', delta: -1 });
            }
          } else {
            if (now - lastLogScrollTimeRef.current >= 30) {
              lastLogScrollTimeRef.current = now;
              const detailEndRow = 1 + viewport.detailPanelHeight;
              if (mouseY <= detailEndRow) {
                const totalLogs = state.services[state.selectedIndex]?.logs?.length || 0;
                const maxScroll = Math.max(0, totalLogs - (viewport.maxServiceLogs || 6));
                dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: 1, maxScroll });
              } else {
                const totalLogs = state.globalLogs.length;
                const maxScroll = Math.max(0, totalLogs - (viewport.maxGlobalLogs || 6));
                dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: 1, maxScroll });
              }
            }
          }
        }

        // 1c. Mouse Wheel DOWN (Base Button 65)
        const isWheelDown = baseButton === 65;
        if (isWheelDown) {
          const now = Date.now();
          if (mouseX <= viewport.leftPanelWidth + 1) {
            if (now - lastServiceNavTimeRef.current >= 75) {
              lastServiceNavTimeRef.current = now;
              dispatch({ type: 'NAVIGATE_SERVICES', delta: 1 });
            }
          } else {
            if (now - lastLogScrollTimeRef.current >= 30) {
              lastLogScrollTimeRef.current = now;
              const detailEndRow = 1 + viewport.detailPanelHeight;
              if (mouseY <= detailEndRow) {
                const totalLogs = state.services[state.selectedIndex]?.logs?.length || 0;
                const maxScroll = Math.max(0, totalLogs - (viewport.maxServiceLogs || 6));
                dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: -1, maxScroll });
              } else {
                const totalLogs = state.globalLogs.length;
                const maxScroll = Math.max(0, totalLogs - (viewport.maxGlobalLogs || 6));
                dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: -1, maxScroll });
              }
            }
          }
        }
      }

      // Legacy mouse wheel fallback if full regex didn't trigger
      if (!processedMouse) {
        if (input.includes('<64;') || input.includes('[<64')) {
          processedMouse = true;
          if (state.activePanel === 'services') {
            dispatch({ type: 'NAVIGATE_SERVICES', delta: -1 });
          } else if (state.activePanel === 'serviceLogs') {
            const totalLogs = state.services[state.selectedIndex]?.logs?.length || 0;
            const maxScroll = Math.max(0, totalLogs - (viewport.maxServiceLogs || 6));
            dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: 1, maxScroll });
          } else if (state.activePanel === 'globalLogs') {
            const totalLogs = state.globalLogs.length;
            const maxScroll = Math.max(0, totalLogs - (viewport.maxGlobalLogs || 6));
            dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: 1, maxScroll });
          }
        } else if (input.includes('<65;') || input.includes('[<65')) {
          processedMouse = true;
          if (state.activePanel === 'services') {
            dispatch({ type: 'NAVIGATE_SERVICES', delta: 1 });
          } else if (state.activePanel === 'serviceLogs') {
            const totalLogs = state.services[state.selectedIndex]?.logs?.length || 0;
            const maxScroll = Math.max(0, totalLogs - (viewport.maxServiceLogs || 6));
            dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: -1, maxScroll });
          } else if (state.activePanel === 'globalLogs') {
            const totalLogs = state.globalLogs.length;
            const maxScroll = Math.max(0, totalLogs - (viewport.maxGlobalLogs || 6));
            dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: -1, maxScroll });
          }
        }
      }

      if (processedMouse) return;
    }

    // -------------------------------------------------------------
    // 2. Keyboard Handlers
    // -------------------------------------------------------------
    // If Help Modal is open
    if (state.showHelp) {
      if (key.escape || input === '?' || input === 'q') {
        dispatch({ type: 'TOGGLE_HELP', show: false });
      }
      return;
    }

    // If Search input is active
    if (state.isSearching) {
      if (key.escape || key.return) {
        dispatch({ type: 'SET_SEARCHING', isSearching: false });
      } else if (key.backspace || key.delete) {
        dispatch({ type: 'POP_SEARCH_CHAR' });
      } else if (input) {
        dispatch({ type: 'APPEND_SEARCH_CHAR', char: input });
      }
      return;
    }

    // Help Modal toggle
    if (input === '?') {
      dispatch({ type: 'TOGGLE_HELP', show: true });
      return;
    }

    // Exit application
    if (input === 'q') {
      exit();
      return;
    }

    // Tab or 't' switches active panel focus
    if (input === 't' || key.tab) {
      if (viewport.width < 72) {
        const next = state.narrowTab === 'services' ? 'detail' : state.narrowTab === 'detail' ? 'logs' : 'services';
        dispatch({ type: 'SET_NARROW_TAB', tab: next });
      } else {
        dispatch({ type: 'CYCLE_PANEL' });
      }
      return;
    }

    // Escape returns focus to services
    if (key.escape) {
      dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'services' });
      return;
    }

    // Enter focuses service logs
    if (key.return) {
      if (state.activePanel === 'services') {
        dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'serviceLogs' });
        return;
      }
    }

    // Helpers for calculating dynamic maxScroll bounds
    const getServiceMaxScroll = () => {
      const totalLogs = state.services[state.selectedIndex]?.logs?.length || 0;
      return Math.max(0, totalLogs - (viewport.maxServiceLogs || 6));
    };

    const getGlobalMaxScroll = () => {
      return Math.max(0, state.globalLogs.length - (viewport.maxGlobalLogs || 6));
    };

    // PageUp / PageDown or '[' / ']' for keyboard log scrolling
    if (key.pageUp || input === '[') {
      if (state.activePanel === 'globalLogs') {
        dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: 4, maxScroll: getGlobalMaxScroll() });
      } else {
        dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: 4, maxScroll: getServiceMaxScroll() });
      }
      return;
    }

    if (key.pageDown || input === ']') {
      if (state.activePanel === 'globalLogs') {
        dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: -4, maxScroll: getGlobalMaxScroll() });
      } else {
        dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: -4, maxScroll: getServiceMaxScroll() });
      }
      return;
    }

    if (key.home) {
      if (state.activePanel === 'globalLogs') {
        const maxScroll = getGlobalMaxScroll();
        dispatch({ type: 'SET_GLOBAL_LOG_SCROLL', value: maxScroll, maxScroll });
      } else {
        const maxScroll = getServiceMaxScroll();
        dispatch({ type: 'SET_SERVICE_LOG_SCROLL', value: maxScroll, maxScroll });
      }
      return;
    }

    if (key.end) {
      if (state.activePanel === 'globalLogs') {
        dispatch({ type: 'SET_GLOBAL_LOG_SCROLL', value: 0 });
      } else {
        dispatch({ type: 'SET_SERVICE_LOG_SCROLL', value: 0 });
      }
      return;
    }

    // Arrow Up / Down or j / k behavior - Instant response, 0 throttle on keyboard
    if (key.upArrow || input === 'k') {
      if (state.activePanel === 'services') {
        dispatch({ type: 'NAVIGATE_SERVICES', delta: -1 });
      } else if (state.activePanel === 'serviceLogs') {
        dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: 1, maxScroll: getServiceMaxScroll() });
      } else if (state.activePanel === 'globalLogs') {
        dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: 1, maxScroll: getGlobalMaxScroll() });
      }
      return;
    }

    if (key.downArrow || input === 'j') {
      if (state.activePanel === 'services') {
        dispatch({ type: 'NAVIGATE_SERVICES', delta: 1 });
      } else if (state.activePanel === 'serviceLogs') {
        dispatch({ type: 'SCROLL_SERVICE_LOGS', delta: -1, maxScroll: getServiceMaxScroll() });
      } else if (state.activePanel === 'globalLogs') {
        dispatch({ type: 'SCROLL_GLOBAL_LOGS', delta: -1, maxScroll: getGlobalMaxScroll() });
      }
      return;
    }

    // Tabs switching (1-4 or left/right arrow)
    if (input === '1') { dispatch({ type: 'SET_ACTIVE_TAB', tab: 'logs' }); return; }
    if (input === '2') { dispatch({ type: 'SET_ACTIVE_TAB', tab: 'errors' }); return; }
    if (input === '3') { dispatch({ type: 'SET_ACTIVE_TAB', tab: 'metrics' }); return; }
    if (input === '4') { dispatch({ type: 'SET_ACTIVE_TAB', tab: 'env' }); return; }

    const tabs: ('logs' | 'errors' | 'metrics' | 'env')[] = ['logs', 'errors', 'metrics', 'env'];
    if (key.leftArrow) {
      const curIdx = tabs.indexOf(state.activeTab);
      dispatch({ type: 'SET_ACTIVE_TAB', tab: tabs[Math.max(0, curIdx - 1)] as any });
      return;
    }
    if (key.rightArrow) {
      const curIdx = tabs.indexOf(state.activeTab);
      dispatch({ type: 'SET_ACTIVE_TAB', tab: tabs[Math.min(tabs.length - 1, curIdx + 1)] as any });
      return;
    }

    // Service actions
    if (input === 'r' || input === 'R') {
      if (onRestartRef.current) onRestartRef.current(stateRef.current.selectedIndex);
      return;
    }
    if (input === 's' || input === 'S') {
      if (onToggleStopRef.current) onToggleStopRef.current(stateRef.current.selectedIndex);
      return;
    }

    // Search and filter
    if (input === '/') {
      dispatch({ type: 'SET_SEARCHING', isSearching: true });
      return;
    }
    if (input === 'f') {
      dispatch({ type: 'CYCLE_FILTER' });
      return;
    }

    // Live toggle
    if (input === 'l' || input === ' ') {
      dispatch({ type: 'TOGGLE_LIVE' });
      return;
    }
  });
}

