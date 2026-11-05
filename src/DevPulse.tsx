import React, { useReducer, useEffect, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import Header from './components/Header.js';
import ServicesPanel from './components/ServicesPanel.js';
import ServiceDetailPanel from './components/ServiceDetailPanel.js';
import GlobalLogsPanel from './components/GlobalLogsPanel.js';
import Footer from './components/Footer.js';
import HelpModal from './components/HelpModal.js';
import LogInspectorModal from './components/common/LogInspectorModal.js';
import { createInitialDashboardState, dashboardReducer } from './state/dashboardReducer.js';
import { useTerminalViewport } from './hooks/useTerminalViewport.js';
import { useTerminalInput } from './hooks/useTerminalInput.js';
import { useProcessRunner } from './hooks/useProcessRunner.js';
import { ClickProvider, Clickable, ClickManagerContextValue } from './components/common/ClickManager.js';
import { theme } from './theme/theme.js';
import { DevPulseConfig } from './types/config.js';
import { LogEntry } from './types/index.js';
import {
  copyToClipboard,
  formatLogEntry,
  formatServiceErrorSummary,
  formatAllErrors
} from './utils/clipboard.js';

export interface DevPulseProps {
  config?: DevPulseConfig;
  onOpenConfig?: () => void;
  onSwitchConfig?: () => void;
  width?: number;
  height?: number;
}

export const DevPulse: React.FC<DevPulseProps> = ({ config, onOpenConfig, onSwitchConfig, width, height }) => {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(dashboardReducer, config, createInitialDashboardState);
  const viewport = useTerminalViewport(width, height);
  const clickManagerRef = useRef<ClickManagerContextValue | null>(null);

  // Real OS Process Manager Orchestration
  const { handleRestart, handleToggleStop } = useProcessRunner({
    config,
    state,
    dispatch
  });

  // Keyboard navigation & hotkeys hook
  useTerminalInput({
    state,
    dispatch,
    viewport,
    exit,
    clickManagerRef,
    onRestart: handleRestart,
    onToggleStop: handleToggleStop,
    onSwitchConfig
  });

  // Assert clean SGR mouse reporting mode on mount
  useEffect(() => {
    try {
      process.stdout.write('\x1b[?1000h\x1b[?1006h');
    } catch {}
  }, []);

  // Time updater
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toTimeString().split(' ')[0] || '12:00:00';
      dispatch({ type: 'TICK_CLOCK', time: now });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedService = state.services[state.selectedIndex] || state.services[0];
  const activeFilter = state.filterOptions[state.filterIndex] || 'All Services';

  // Dynamically derive honest system status for Header
  const runningCount = state.services.filter(s => s.status === 'running').length;
  const startingCount = state.services.filter(s => s.status === 'starting').length;
  const totalCount = state.services.length;

  let headerStatus = 'All Systems Running';
  let headerColor: string = theme.colors.running;

  if (totalCount === 0) {
    headerStatus = 'No Services Configured';
    headerColor = theme.colors.textMuted;
  } else if (startingCount > 0) {
    headerStatus = 'Booting Services';
    headerColor = theme.colors.accent;
  } else if (runningCount === 0) {
    headerStatus = 'All Services Stopped';
    headerColor = theme.colors.stopped;
  } else if (runningCount < totalCount) {
    headerStatus = `${runningCount}/${totalCount} Services Active`;
    headerColor = theme.colors.warning;
  }

  // Copy helpers
  const handleCopyCurrent = () => {
    if (state.activeTab === 'errors' && selectedService) {
      const err = selectedService.errorLogs?.[selectedService.errorLogs.length - 1];
      if (err) {
        copyToClipboard(err.message);
        dispatch({ type: 'SHOW_TOAST', message: `✔ Copied error from "${selectedService.name}"` });
      } else if (selectedService.lastError) {
        copyToClipboard(selectedService.lastError);
        dispatch({ type: 'SHOW_TOAST', message: `✔ Copied error from "${selectedService.name}"` });
      } else {
        dispatch({ type: 'SHOW_TOAST', message: `ℹ No errors to copy for "${selectedService.name}"` });
      }
    } else if (selectedService) {
      const log = selectedService.logs?.[selectedService.logs.length - 1];
      if (log) {
        copyToClipboard(formatLogEntry(log, selectedService.name));
        dispatch({ type: 'SHOW_TOAST', message: `✔ Copied log from "${selectedService.name}"` });
      } else {
        const text = formatServiceErrorSummary(selectedService);
        copyToClipboard(text);
        dispatch({ type: 'SHOW_TOAST', message: `✔ Copied summary for "${selectedService.name}"` });
      }
    }
  };

  const handleCopyLog = (log: LogEntry) => {
    copyToClipboard(log.message);
    dispatch({ type: 'SHOW_TOAST', message: `✔ Copied log from "${log.service || selectedService?.name || 'service'}"` });
  };

  const handleInspectLog = (log: LogEntry) => {
    dispatch({ type: 'OPEN_LOG_INSPECTOR', log });
  };

  const handleCopyGlobalCurrent = () => {
    const log = state.globalLogs[state.globalLogs.length - 1];
    if (log) {
      copyToClipboard(formatLogEntry(log));
      dispatch({ type: 'SHOW_TOAST', message: '✔ Copied latest global log' });
    } else {
      dispatch({ type: 'SHOW_TOAST', message: 'ℹ No global logs to copy' });
    }
  };

  return (
    <ClickProvider clickManagerRef={clickManagerRef}>
      <Box 
        flexDirection="column" 
        width={viewport.width} 
        height={viewport.height}
        backgroundColor={theme.colors.canvas}
        justifyContent="space-between"
        paddingX={0}
        paddingY={0}
      >
        {/* 1. Header Bar (Row 1, guaranteed 1 line) */}
        <Header 
          time={state.time} 
          systemStatus={headerStatus} 
          statusColor={headerColor}
          width={viewport.width}
          toastMessage={state.toastMessage}
        />

        {/* 2. Main Content Area */}
        {viewport.isUltraNarrow ? (
          /* Ultra-Narrow Single Column View with Top Switcher */
          <Box flexDirection="column" width={viewport.width} height={viewport.contentHeight}>
            <Box flexDirection="row" marginBottom={0} paddingX={1} flexWrap="nowrap">
              <Clickable onClick={() => dispatch({ type: 'SET_NARROW_TAB', tab: 'services' })}>
                <Text color={state.narrowTab === 'services' ? theme.colors.accent : theme.colors.textMuted} bold={state.narrowTab === 'services'}>
                  [1: Services]{' '}
                </Text>
              </Clickable>
              <Clickable onClick={() => dispatch({ type: 'SET_NARROW_TAB', tab: 'detail' })}>
                <Text color={state.narrowTab === 'detail' ? theme.colors.accent : theme.colors.textMuted} bold={state.narrowTab === 'detail'}>
                  [2: Detail]{' '}
                </Text>
              </Clickable>
              <Clickable onClick={() => dispatch({ type: 'SET_NARROW_TAB', tab: 'logs' })}>
                <Text color={state.narrowTab === 'logs' ? theme.colors.accent : theme.colors.textMuted} bold={state.narrowTab === 'logs'}>
                  [3: Global Logs]
                </Text>
              </Clickable>
            </Box>
            {state.narrowTab === 'services' && (
              <Box flexDirection="column" width={viewport.width} height={viewport.contentHeight - 1}>
                <ServicesPanel 
                  services={state.services} 
                  selectedIndex={state.selectedIndex}
                  isFocused={state.activePanel === 'services'}
                  isCompactHeight={true}
                  panelWidth={viewport.width}
                  height={viewport.servicesPanelHeight}
                  onSelectService={(idx) => dispatch({ type: 'SELECT_SERVICE', index: idx })}
                  onFocus={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'services' })}
                />
              </Box>
            )}
            {state.narrowTab === 'detail' && (
              <ServiceDetailPanel 
                service={selectedService} 
                activeTab={state.activeTab}
                isRestarting={state.restartingServiceId === selectedService?.id}
                maxLogs={Math.max(4, viewport.contentHeight - 6)}
                isFocused={true}
                scrollOffset={state.serviceLogScroll}
                panelWidth={viewport.width}
                height={viewport.contentHeight - 1}
                onRestart={() => handleRestart(state.selectedIndex)}
                onToggleStop={() => handleToggleStop(state.selectedIndex)}
                onSelectTab={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
                onFocus={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'serviceLogs' })}
                onCopyCurrent={handleCopyCurrent}
                onCopyLog={handleCopyLog}
                onInspectLog={handleInspectLog}
              />
            )}
            {state.narrowTab === 'logs' && (
              <GlobalLogsPanel 
                logs={state.globalLogs}
                searchQuery={state.searchQuery}
                isSearching={state.isSearching}
                activeFilter={activeFilter}
                isLive={state.isLive}
                maxLogs={Math.max(4, viewport.contentHeight - 4)}
                isFocused={true}
                scrollOffset={state.globalLogScroll}
                panelWidth={viewport.width}
                height={viewport.contentHeight - 1}
                onToggleSearch={() => dispatch({ type: 'SET_SEARCHING', isSearching: !state.isSearching })}
                onCycleFilter={() => dispatch({ type: 'CYCLE_FILTER' })}
                onToggleLive={() => dispatch({ type: 'TOGGLE_LIVE' })}
                onFocus={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'globalLogs' })}
                onCopyCurrent={handleCopyGlobalCurrent}
                onCopyLog={handleCopyLog}
                onInspectLog={handleInspectLog}
              />
            )}
          </Box>
        ) : (
          /* Standard 2-Column Responsive Dashboard */
          <Box flexDirection="row" width={viewport.width} height={viewport.contentHeight} backgroundColor={theme.colors.canvas}>
            {/* Left Column (Services Panel Full Height) */}
            <Box flexDirection="column" width={viewport.leftPanelWidth} height={viewport.contentHeight} marginRight={1} backgroundColor={theme.colors.canvas}>
              <ServicesPanel 
                services={state.services} 
                selectedIndex={state.selectedIndex}
                isFocused={state.activePanel === 'services'}
                isCompactHeight={viewport.isCompactHeight}
                panelWidth={viewport.leftPanelWidth}
                height={viewport.servicesPanelHeight}
                onSelectService={(idx) => dispatch({ type: 'SELECT_SERVICE', index: idx })}
                onFocus={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'services' })}
              />
            </Box>

            {/* Right Column (Service Detail & Global Logs) */}
            <Box flexDirection="column" width={viewport.rightPanelWidth} height={viewport.contentHeight} backgroundColor={theme.colors.canvas}>
              <ServiceDetailPanel 
                service={selectedService} 
                activeTab={state.activeTab}
                isRestarting={state.restartingServiceId === selectedService?.id}
                maxLogs={viewport.maxServiceLogs}
                isFocused={state.activePanel === 'serviceLogs'}
                scrollOffset={state.serviceLogScroll}
                panelWidth={viewport.rightPanelWidth}
                height={viewport.detailPanelHeight}
                isUltraCompact={viewport.isUltraCompactHeight}
                onRestart={() => handleRestart(state.selectedIndex)}
                onToggleStop={() => handleToggleStop(state.selectedIndex)}
                onSelectTab={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
                onFocus={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'serviceLogs' })}
                onCopyCurrent={handleCopyCurrent}
                onCopyLog={handleCopyLog}
                onInspectLog={handleInspectLog}
              />
              <GlobalLogsPanel 
                logs={state.globalLogs}
                searchQuery={state.searchQuery}
                isSearching={state.isSearching}
                activeFilter={activeFilter}
                isLive={state.isLive}
                maxLogs={viewport.maxGlobalLogs}
                isFocused={state.activePanel === 'globalLogs'}
                scrollOffset={state.globalLogScroll}
                panelWidth={viewport.rightPanelWidth}
                height={viewport.globalLogsPanelHeight}
                onToggleSearch={() => dispatch({ type: 'SET_SEARCHING', isSearching: !state.isSearching })}
                onCycleFilter={() => dispatch({ type: 'CYCLE_FILTER' })}
                onToggleLive={() => dispatch({ type: 'TOGGLE_LIVE' })}
                onFocus={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: 'globalLogs' })}
                onCopyCurrent={handleCopyGlobalCurrent}
                onCopyLog={handleCopyLog}
                onInspectLog={handleInspectLog}
              />
            </Box>
          </Box>
        )}

        {/* 3. Footer Bar (Bottom Row, guaranteed 1 line) */}
        <Footer 
          isConnected={true} 
          activePanel={state.activePanel} 
          width={viewport.width} 
          onToggleHelp={() => dispatch({ type: 'TOGGLE_HELP', show: !state.showHelp })}
          onSwitchConfig={onSwitchConfig}
        />

        {/* 4. Optional Help Overlay Modal */}
        {state.showHelp && (
          <Box 
            position="absolute" 
            width={viewport.width} 
            height={viewport.height} 
            alignItems="center" 
            justifyContent="center"
          >
            <HelpModal 
              onClose={() => dispatch({ type: 'TOGGLE_HELP', show: false })} 
              width={viewport.width}
              height={viewport.height}
            />
          </Box>
        )}

        {/* 5. Optional Log Inspector Overlay Modal */}
        {state.inspectingLog && (
          <Box 
            position="absolute" 
            width={viewport.width} 
            height={viewport.height} 
            alignItems="center" 
            justifyContent="center"
          >
            <LogInspectorModal 
              log={state.inspectingLog}
              serviceName={selectedService?.name}
              onClose={() => dispatch({ type: 'CLOSE_LOG_INSPECTOR' })}
              onCopy={() => {
                const text = state.inspectingLog?.message || '';
                copyToClipboard(text);
                dispatch({ type: 'SHOW_TOAST', message: '✔ Copied inspected message to clipboard!' });
              }}
              width={viewport.width}
              height={viewport.height}
            />
          </Box>
        )}
      </Box>
    </ClickProvider>
  );
};

export default DevPulse;
