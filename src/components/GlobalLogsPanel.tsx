import React from 'react';
import { Box, Text } from 'ink';
import { LogEntry } from '../types/index.js';
import Clickable from './common/ClickManager.js';
import { theme, getServiceBadgeStyle } from '../theme/theme.js';

export interface GlobalLogsPanelProps {
  logs?: LogEntry[];
  searchQuery?: string;
  isSearching?: boolean;
  activeFilter?: string;
  isLive?: boolean;
  maxLogs?: number;
  isFocused?: boolean;
  scrollOffset?: number;
  panelWidth?: number;
  height?: number;
  onToggleSearch?: () => void;
  onCycleFilter?: () => void;
  onToggleLive?: () => void;
  onFocus?: () => void;
}

export const GlobalLogsPanel: React.FC<GlobalLogsPanelProps> = React.memo(({ 
  logs = [], 
  searchQuery = '', 
  isSearching = false, 
  activeFilter = 'All Services', 
  isLive = true,
  maxLogs = 6,
  isFocused = false,
  scrollOffset = 0,
  panelWidth = 53,
  height,
  onToggleSearch,
  onCycleFilter,
  onToggleLive,
  onFocus
}) => {
  const isNarrow = panelWidth < 65;
  const innerWidth = Math.max(20, panelWidth - 4);
  const maxMsgLen = Math.max(12, innerWidth - 22);

  const renderMessage = (log: LogEntry) => {
    const rawMsg = log.message;
    const msg = rawMsg.length > maxMsgLen ? rawMsg.slice(0, maxMsgLen - 1) + '…' : rawMsg;

    // Red error message with cross icon
    if (msg.includes('✖') || log.level === 'error' || log.level === 'ERROR') {
      return (
        <Text>
          <Text color={theme.colors.stopped} bold>✖ </Text>
          <Text color={theme.colors.stopped}>{msg.replace('✖', '').trim()}</Text>
        </Text>
      );
    }

    // Retrying warning
    if (msg.includes('Retrying') || log.level === 'warn' || log.level === 'WARN') {
      return <Text color={theme.colors.warning}>{msg}</Text>;
    }

    // HTTP method and status (e.g. GET /api/auth/me  200  (12 ms))
    const httpMatch = msg.match(/^(POST|GET|PUT|DELETE)\s+(\S+)\s+(\d{3})\s+(\([^)]+\))$/);
    if (httpMatch) {
      const [, method, path, status, latency] = httpMatch;
      const statusCodeColor = (status || '').startsWith('2') ? theme.colors.running : theme.colors.stopped;
      return (
        <Text>
          <Text color={theme.colors.textPrimary}>{method} {path} </Text>
          <Text color={statusCodeColor} bold>{status} </Text>
          <Text color={theme.colors.textMuted}>{latency}</Text>
        </Text>
      );
    }

    // Trailing latency (e.g. User profile fetched  (28 ms))
    const latencyMatch = msg.match(/^(.*?)\s{2,}(\([^)]+\))$/);
    if (latencyMatch) {
      const [, prefix, latency] = latencyMatch;
      return (
        <Text>
          <Text color={theme.colors.textPrimary}>{prefix} </Text>
          <Text color={theme.colors.textMuted}>{latency}</Text>
        </Text>
      );
    }

    // URLs (e.g. Server listening on http://localhost:3001)
    if (msg.includes('http://')) {
      const [before, url] = msg.split('http://');
      return (
        <Text>
          <Text color={theme.colors.textPrimary}>{before}</Text>
          <Text color={theme.colors.accent} underline>http://{url}</Text>
        </Text>
      );
    }

    return <Text color={theme.colors.textPrimary}>{msg}</Text>;
  };

  // Filter logs if filter or search active
  const matchingLogs = logs.filter(l => {
    if (activeFilter !== 'All Services' && l.service.toLowerCase() !== activeFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return l.message.toLowerCase().includes(q) || l.service.toLowerCase().includes(q);
    }
    return true;
  });

  const totalFiltered = matchingLogs.length;
  const maxScroll = Math.max(0, totalFiltered - maxLogs);
  const effectiveOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
  const endIdx = totalFiltered - effectiveOffset;
  const startIdx = Math.max(0, endIdx - maxLogs);
  const visibleLogs = matchingLogs.slice(startIdx, endIdx);

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
      marginTop={0}
    >
      {/* Header: Guaranteed 1 line with inline modern pills */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        {/* Left Title */}
        <Box flexDirection="row" alignItems="center" flexShrink={0}>
          <Text color={isFocused ? theme.colors.accent : theme.colors.textSecondary} bold>GLOBAL LOGS </Text>
          {!isNarrow && <Text color={theme.colors.textMuted}>({activeFilter}) </Text>}
          {effectiveOffset > 0 ? (
            <Text color={theme.colors.warning} bold> ▲ (+{effectiveOffset}) [{startIdx + 1}-{endIdx}/{totalFiltered}]</Text>
          ) : isFocused ? (
            <Text color={theme.colors.accent}> [↑↓ Scroll]</Text>
          ) : null}
        </Box>

        {/* Right Controls: 1-line inline pills */}
        <Box flexDirection="row" alignItems="center" flexShrink={0}>
          {/* Search pill */}
          <Clickable onClick={() => onToggleSearch?.()}>
            <Text 
              backgroundColor={isSearching ? theme.colors.accentDark : theme.colors.card} 
              color={isSearching ? theme.colors.accent : theme.colors.textSecondary}
            >
              {' '}🔍 {isNarrow ? (searchQuery || '') : (searchQuery || 'Search...')}{' '}
            </Text>
          </Clickable>
          <Text> </Text>

          {/* Filter dropdown pill */}
          <Clickable onClick={() => onCycleFilter?.()}>
            <Text backgroundColor={theme.colors.card} color={theme.colors.textSecondary}>
              {' '}{isNarrow ? (activeFilter === 'All Services' ? 'All' : activeFilter) : activeFilter} ∨{' '}
            </Text>
          </Clickable>
          <Text> </Text>

          {/* Live badge pill */}
          <Clickable onClick={() => onToggleLive?.()}>
            <Text 
              backgroundColor={isLive ? theme.colors.runningBg : theme.colors.warningBg} 
              color={isLive ? theme.colors.running : theme.colors.warning} 
              bold
            >
              {' '}● {isLive ? 'Live' : 'Off'}{' '}
            </Text>
          </Clickable>
        </Box>
      </Box>

      {/* Global Logs Stream */}
      <Box flexDirection="column" marginTop={0}>
        {visibleLogs.map((log) => {
          const badge = getServiceBadgeStyle(log.service);

          return (
            <Box key={log.id} flexDirection="row" alignItems="center" marginBottom={0} flexWrap="nowrap">
              <Box width={9} flexShrink={0}>
                <Text color={theme.colors.textMuted}>{log.timestamp} </Text>
              </Box>
              <Box width={10} marginRight={1} flexShrink={0}>
                <Text backgroundColor={badge.bg} color={badge.fg} bold>
                  {badge.label}
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                {renderMessage(log)}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Clickable>
  );
});

export default GlobalLogsPanel;
