import React from 'react';
import { Box, Text } from 'ink';
import { LogEntry } from '../../types/index.js';
import Clickable from './ClickManager.js';
import { theme } from '../../theme/theme.js';

export interface LogInspectorModalProps {
  log: LogEntry;
  serviceName?: string;
  onClose: () => void;
  onCopy: () => void;
  width?: number;
  height?: number;
}

export const LogInspectorModal: React.FC<LogInspectorModalProps> = React.memo(({
  log,
  serviceName,
  onClose,
  onCopy,
  width = 80,
  height
}) => {
  const modalWidth = Math.min(Math.max(width - 6, 40), 90);
  const svc = serviceName || log.service || 'Service';
  const lvl = (log.level || 'info').toUpperCase();
  const isErr = lvl === 'ERROR';
  const isWarn = lvl === 'WARN';

  const lvlColor = isErr ? theme.colors.stopped : isWarn ? theme.colors.warning : theme.colors.accent;
  const lvlBg = isErr ? theme.colors.stoppedBg : isWarn ? theme.colors.warningBg : theme.colors.card;

  const contentWidth = modalWidth - 4;

  // Split message into lines for clean multi-line display
  const messageLines = (log.message || '').split(/\r?\n/);
  // Cap displayed lines so modal does not overflow screen
  const maxLines = height ? Math.max(5, height - 10) : 16;
  const visibleLines = messageLines.slice(0, maxLines);
  const hasMoreLines = messageLines.length > maxLines;

  return (
    <Box
      borderStyle="round"
      borderColor={isErr ? theme.colors.stopped : theme.colors.borderFocus}
      borderBackgroundColor={theme.colors.canvas}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      width={modalWidth}
      backgroundColor={theme.colors.surface}
    >
      {/* 1. Header Bar */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <Box flexDirection="row" alignItems="center">
          <Text color={isErr ? theme.colors.stopped : theme.colors.accent} bold>
            🔍 Log & Error Inspector
          </Text>
        </Box>
        <Box flexDirection="row" alignItems="center">
          <Box backgroundColor={lvlBg} paddingX={1} marginRight={1}>
            <Text color={lvlColor} bold>[{lvl}]</Text>
          </Box>
          <Box backgroundColor={theme.colors.card} paddingX={1}>
            <Text color={theme.colors.textPrimary} bold>{svc}</Text>
          </Box>
        </Box>
      </Box>

      {/* Metadata Bar */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <Text color={theme.colors.textMuted}>Time: {log.timestamp || 'N/A'}</Text>
        <Text color={theme.colors.textMuted}>Length: {log.message.length} chars ({messageLines.length} line{messageLines.length === 1 ? '' : 's'})</Text>
      </Box>

      {/* Hairline Divider */}
      <Box width="100%" height={1} overflow="hidden" marginBottom={1}>
        <Text color={theme.colors.borderSubtle}>{'─'.repeat(contentWidth)}</Text>
      </Box>

      {/* 2. Full Un-truncated Message Body */}
      <Box
        flexDirection="column"
        backgroundColor={theme.colors.canvas}
        paddingX={1}
        paddingY={1}
        marginBottom={1}
        borderStyle="single"
        borderColor={theme.colors.borderSubtle}
      >
        {visibleLines.map((line, idx) => (
          <Text key={idx} color={isErr ? theme.colors.stopped : theme.colors.textPrimary} wrap="wrap">
            {line || ' '}
          </Text>
        ))}
        {hasMoreLines && (
          <Text color={theme.colors.textMuted} italic>
            ... (+{messageLines.length - maxLines} more lines truncated in view, full message copies to clipboard)
          </Text>
        )}
      </Box>

      {/* 3. Action Buttons & Keyboard Hints */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={0}>
        <Clickable onClick={onCopy}>
          <Box backgroundColor={theme.colors.runningBg} paddingX={1} marginRight={1}>
            <Text color={theme.colors.running} bold>[ 📋 Copy to Clipboard (c / Enter) ]</Text>
          </Box>
        </Clickable>

        <Clickable onClick={onClose}>
          <Box backgroundColor={theme.colors.card} paddingX={1}>
            <Text color={theme.colors.textSecondary} bold>[ Close (Esc) ]</Text>
          </Box>
        </Clickable>
      </Box>
    </Box>
  );
});

export default LogInspectorModal;

