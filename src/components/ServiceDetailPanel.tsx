import React from 'react';
import { Box, Text } from 'ink';
import { Service, ActiveTab } from '../types/index.js';
import Clickable from './common/ClickManager.js';
import { theme } from '../theme/theme.js';

export interface ServiceDetailPanelProps {
  service?: Service;
  activeTab?: ActiveTab;
  isRestarting?: boolean;
  maxLogs?: number;
  isFocused?: boolean;
  scrollOffset?: number;
  panelWidth?: number;
  height?: number;
  isUltraCompact?: boolean;
  onRestart?: () => void;
  onToggleStop?: () => void;
  onSelectTab?: (tab: ActiveTab) => void;
  onFocus?: () => void;
}

const cleanPort = (p?: string | number) => {
  if (!p) return '';
  const str = String(p).trim();
  const num = str.replace(/^:+/, '');
  return `:${num}`;
};

export const ServiceDetailPanel: React.FC<ServiceDetailPanelProps> = React.memo(({ 
  service, 
  activeTab = 'logs', 
  isRestarting = false, 
  maxLogs = 6,
  isFocused = false,
  scrollOffset = 0,
  panelWidth = 53,
  height,
  isUltraCompact = false,
  onRestart,
  onToggleStop,
  onSelectTab,
  onFocus
}) => {
  if (!service) return null;

  const isNarrow = panelWidth < 65;
  const innerWidth = Math.max(20, panelWidth - 4);
  const maxMsgLen = Math.max(12, innerWidth - 22);

  const isRunning = service.status === 'running';

  const getStatusInfo = () => {
    if (isRestarting || service.status === 'starting') {
      return { 
        bg: theme.colors.warningBg, 
        fg: theme.colors.warning, 
        text: isRestarting ? 'RESTARTING' : 'STARTING', 
        dot: theme.colors.warning 
      };
    }
    switch (service.status) {
      case 'running':
        return { 
          bg: theme.colors.runningBg, 
          fg: theme.colors.running, 
          text: 'RUNNING', 
          dot: theme.colors.running 
        };
      case 'stopped':
        return { 
          bg: theme.colors.stoppedBg, 
          fg: theme.colors.stopped, 
          text: 'STOPPED', 
          dot: theme.colors.stopped 
        };
      case 'warning':
        return { 
          bg: theme.colors.warningBg, 
          fg: theme.colors.warning, 
          text: 'WARN', 
          dot: theme.colors.warning 
        };
      default:
        return { 
          bg: theme.colors.card, 
          fg: theme.colors.textMuted, 
          text: 'OFFLINE', 
          dot: theme.colors.textMuted 
        };
    }
  };

  const status = getStatusInfo();

  const renderLogMessage = (msg: string) => {
    const truncated = msg.length > maxMsgLen ? msg.slice(0, maxMsgLen - 1) + '…' : msg;

    if (truncated.includes('✖')) {
      return (
        <Text>
          <Text color={theme.colors.stopped} bold>✖ </Text>
          <Text color={theme.colors.stopped}>{truncated.replace('✖', '').trim()}</Text>
        </Text>
      );
    }

    const httpRegex = /^(POST|GET|PUT|DELETE)\s+(\S+)\s+(\d{3})\s+(\([^)]+\))$/;
    const httpMatch = truncated.trim().match(httpRegex);
    if (httpMatch) {
      const [, method, path, statusCode, latency] = httpMatch;
      const statusCodeColor = (statusCode || '').startsWith('2') ? theme.colors.running : theme.colors.stopped;
      return (
        <Text>
          <Text color={theme.colors.accent} bold>{method} </Text>
          <Text color={theme.colors.textPrimary}>{path}  </Text>
          <Text color={statusCodeColor} bold>{statusCode}  </Text>
          <Text color={theme.colors.textMuted}>{latency}</Text>
        </Text>
      );
    }

    if (truncated.includes('http://')) {
      const [before, url] = truncated.split('http://');
      return (
        <Text>
          <Text color={theme.colors.textPrimary}>{before}</Text>
          <Text color={theme.colors.accent} underline>http://{url}</Text>
        </Text>
      );
    }

    return <Text color={theme.colors.textPrimary}>{truncated}</Text>;
  };

  const allLogs = service.logs || [];
  const totalLogs = allLogs.length;
  const maxScroll = Math.max(0, totalLogs - maxLogs);
  const effectiveOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
  const endIdx = totalLogs - effectiveOffset;
  const startIdx = Math.max(0, endIdx - maxLogs);
  const visibleLogs = allLogs.slice(startIdx, endIdx);

  return (
    <Clickable 
      onClick={() => onFocus?.()}
      borderStyle="round" 
      borderColor={isFocused ? theme.colors.borderFocus : theme.colors.borderDefault} 
      borderBackgroundColor={theme.colors.canvas}
      backgroundColor={theme.colors.surface}
      flexDirection="column" 
      paddingX={1}
      paddingY={0}
      width={panelWidth}
      height={height}
      marginBottom={1}
    >
      {/* 1. Header: Service Name, Badge & Actions (Guaranteed 1 line) */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        {/* Left: Name and Pill Badge */}
        <Box flexDirection="row" alignItems="center" flexShrink={0}>
          <Text color={status.dot}>● </Text>
          <Text color={theme.colors.textPrimary} bold>{service.name} </Text>
          <Text backgroundColor={status.bg} color={status.fg} bold> {status.text} </Text>
        </Box>

        {/* Right: Modern 1-line Action Pills */}
        <Box flexDirection="row" alignItems="center" flexShrink={0}>
          <Clickable onClick={() => onRestart?.()}>
            <Text backgroundColor={theme.colors.accentDark} color={theme.colors.accent} bold>
              {' '}↻ {isNarrow ? 'R' : 'Restart'}{' '}
            </Text>
          </Clickable>
          <Text> </Text>
          <Clickable onClick={() => onToggleStop?.()}>
            <Text 
              backgroundColor={isRunning ? theme.colors.stoppedBg : theme.colors.runningBg} 
              color={isRunning ? theme.colors.stopped : theme.colors.running} 
              bold
            >
              {' '}{isRunning ? (isNarrow ? '■ S' : '■ Stop') : (isNarrow ? '▶ R' : '▶ Run')}{' '}
            </Text>
          </Clickable>
          <Text> </Text>
          <Text backgroundColor={theme.colors.card} color={theme.colors.textMuted}> ··· </Text>
        </Box>
      </Box>

      {/* 2. Subheader Metadata (1 line) */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={0} flexWrap="nowrap">
        <Box flexDirection="row" alignItems="center" flexShrink={1}>
          <Text color={theme.colors.textSecondary}>↓ {service.command}</Text>
          <Text color={theme.colors.textDim}> │ </Text>
          <Text color={theme.colors.textSecondary}>PID </Text>
          <Text color={theme.colors.textPrimary} bold>{service.pid}</Text>
          {cleanPort(service.port) ? (
            <>
              <Text color={theme.colors.textDim}> │ </Text>
              <Text color={theme.colors.accent}>Port {cleanPort(service.port)}</Text>
            </>
          ) : null}
        </Box>
        {effectiveOffset > 0 ? (
          <Text color={theme.colors.warning} bold>
            ▲ (+{effectiveOffset}) [{startIdx + 1}-{endIdx}/{totalLogs}]
          </Text>
        ) : isFocused ? (
          <Text color={theme.colors.accent}>[↑↓ Scroll]</Text>
        ) : null}
      </Box>

      {/* 3. Tabs Row & Underline (Hidden in ultra-compact height <= 17 rows) */}
      {!isUltraCompact && (
        <Box flexDirection="row" flexWrap="nowrap" marginTop={0} marginBottom={0}>
          {/* Logs Tab */}
          <Clickable 
            onClick={() => {
              onFocus?.();
              onSelectTab?.('logs');
            }}
            flexDirection="column"
          >
            <Box 
              backgroundColor={activeTab === 'logs' ? theme.colors.card : undefined} 
              paddingX={1}
            >
              <Text color={activeTab === 'logs' ? theme.colors.accent : theme.colors.textMuted} bold={activeTab === 'logs'}>
                Logs
              </Text>
            </Box>
            <Text color={activeTab === 'logs' ? theme.colors.accent : theme.colors.borderSubtle}>──────</Text>
          </Clickable>
          <Box flexDirection="column">
            <Text> </Text>
            <Text color={theme.colors.borderSubtle}> </Text>
          </Box>

          {/* Errors Tab */}
          <Clickable 
            onClick={() => {
              onFocus?.();
              onSelectTab?.('errors');
            }}
            flexDirection="column"
          >
            <Box 
              backgroundColor={activeTab === 'errors' ? theme.colors.card : undefined} 
              paddingX={1}
              flexDirection="row"
            >
              <Text color={activeTab === 'errors' ? theme.colors.accent : theme.colors.textMuted} bold={activeTab === 'errors'}>
                Errors{' '}
              </Text>
              <Text color={service.errors > 0 ? theme.colors.stopped : theme.colors.textMuted} bold>
                ({service.errors || 0})
              </Text>
            </Box>
            <Text color={activeTab === 'errors' ? theme.colors.accent : theme.colors.borderSubtle}>───────────</Text>
          </Clickable>
          <Box flexDirection="column">
            <Text> </Text>
            <Text color={theme.colors.borderSubtle}> </Text>
          </Box>

          {/* Metrics Tab */}
          <Clickable 
            onClick={() => {
              onFocus?.();
              onSelectTab?.('metrics');
            }}
            flexDirection="column"
          >
            <Box 
              backgroundColor={activeTab === 'metrics' ? theme.colors.card : undefined} 
              paddingX={1}
            >
              <Text color={activeTab === 'metrics' ? theme.colors.accent : theme.colors.textMuted} bold={activeTab === 'metrics'}>
                Metrics
              </Text>
            </Box>
            <Text color={activeTab === 'metrics' ? theme.colors.accent : theme.colors.borderSubtle}>─────────</Text>
          </Clickable>
          <Box flexDirection="column">
            <Text> </Text>
            <Text color={theme.colors.borderSubtle}> </Text>
          </Box>

          {/* Env Tab */}
          <Clickable 
            onClick={() => {
              onFocus?.();
              onSelectTab?.('env');
            }}
            flexDirection="column"
          >
            <Box 
              backgroundColor={activeTab === 'env' ? theme.colors.card : undefined} 
              paddingX={1}
            >
              <Text color={activeTab === 'env' ? theme.colors.accent : theme.colors.textMuted} bold={activeTab === 'env'}>
                Env
              </Text>
            </Box>
            <Text color={activeTab === 'env' ? theme.colors.accent : theme.colors.borderSubtle}>─────</Text>
          </Clickable>

          {/* Trailing underline across remaining width */}
          {innerWidth > 35 && (
            <Box flexDirection="column">
              <Text>{' '.repeat(Math.min(30, innerWidth - 34))}</Text>
              <Text color={theme.colors.borderDefault}>{'─'.repeat(Math.min(30, innerWidth - 34))}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* 5. Tab Content */}
      {activeTab === 'logs' && (
        <Box flexDirection="column">
          {visibleLogs.map((log, index) => (
            <Box key={index} flexDirection="row" alignItems="center" flexWrap="nowrap">
              <Text color={theme.colors.textMuted}>{log.timestamp} </Text>
              <Text color={theme.colors.accent} backgroundColor={theme.colors.accentDark} bold> INFO </Text>
              <Text> </Text>
              {renderLogMessage(log.message)}
            </Box>
          ))}
        </Box>
      )}

      {activeTab === 'errors' && (
        <Box flexDirection="column">
          {service.errorLogs && service.errorLogs.length > 0 ? (
            service.errorLogs.slice(0, maxLogs).map((err, i) => (
              <Box key={i} flexDirection="row" flexWrap="nowrap">
                <Text color={theme.colors.textMuted}>{err.timestamp} </Text>
                <Text color={theme.colors.stopped} backgroundColor={theme.colors.stoppedBg} bold> ERROR </Text>
                <Text> </Text>
                <Text color={theme.colors.stopped}>{err.message.slice(0, maxMsgLen)}</Text>
              </Box>
            ))
          ) : (
            <Box>
              <Text color={theme.colors.running}>✔ No active errors logged for {service.name}</Text>
            </Box>
          )}
        </Box>
      )}

      {activeTab === 'metrics' && (
        <Box flexDirection="column">
          <Box justifyContent="space-between" width={Math.min(45, innerWidth)} flexWrap="nowrap">
            <Text color={theme.colors.textSecondary}>CPU Utilization:</Text>
            <Text color={theme.colors.textPrimary} bold>{service.metrics?.cpu || '12%'}</Text>
          </Box>
          <Box justifyContent="space-between" width={Math.min(45, innerWidth)} flexWrap="nowrap">
            <Text color={theme.colors.textSecondary}>Memory RSS:</Text>
            <Text color={theme.colors.textPrimary} bold>{service.metrics?.memory || '120 MB'}</Text>
          </Box>
          <Box justifyContent="space-between" width={Math.min(45, innerWidth)} flexWrap="nowrap">
            <Text color={theme.colors.textSecondary}>Latency P50/P99:</Text>
            <Text color={theme.colors.accent} bold>{service.metrics?.p50 || '18ms'}/{service.metrics?.p99 || '45ms'}</Text>
          </Box>
        </Box>
      )}

      {activeTab === 'env' && (
        <Box flexDirection="column">
          {(service.env || []).slice(0, maxLogs).map((item, i) => (
            <Box key={i} justifyContent="space-between" width={Math.min(50, innerWidth)} flexWrap="nowrap">
              <Text color={theme.colors.accent}>{item.key}</Text>
              <Text color={theme.colors.textSecondary}>{item.value}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Clickable>
  );
});

export default ServiceDetailPanel;
