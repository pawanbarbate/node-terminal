import React from 'react';
import { Box, Text } from 'ink';
import { SystemMetrics } from '../types/index.js';
import { theme } from '../theme/theme.js';

export interface SystemPanelProps {
  metrics?: SystemMetrics;
  panelWidth?: number;
  height?: number;
  isUltraCompact?: boolean;
  workspaceName?: string;
}

export const SystemPanel: React.FC<SystemPanelProps> = React.memo(({ 
  metrics, 
  panelWidth = 34, 
  height,
  isUltraCompact = false,
  workspaceName
}) => {
  const servicesRunning = metrics?.servicesRunning ?? 0;
  const servicesTotal = metrics?.servicesTotal ?? 0;
  const uptime = metrics?.uptime ?? '0s';
  const errorsTotal = metrics?.errorsTotal ?? metrics?.errors1h ?? 0;

  // Derive honest health status
  const getHealthBadge = () => {
    if (servicesTotal === 0) {
      return { text: 'Empty', color: theme.colors.textMuted };
    }
    if (servicesRunning === servicesTotal) {
      return { text: '● Healthy', color: theme.colors.running };
    }
    if (servicesRunning > 0) {
      return { text: '▲ Degraded', color: theme.colors.warning };
    }
    return { text: '■ Stopped', color: theme.colors.stopped };
  };

  const health = getHealthBadge();

  // Ultra-compact mode for short terminals (termHeight < 18): exactly 3 lines total (1 content line + 2 borders)
  if (isUltraCompact) {
    return (
      <Box 
        borderStyle="round" 
        borderColor={theme.colors.borderDefault} 
        borderBackgroundColor={theme.colors.canvas}
        backgroundColor={theme.colors.surface}
        flexDirection="row" 
        justifyContent="space-between"
        alignItems="center"
        paddingX={1}
        paddingY={0}
        width={panelWidth}
        height={height ?? 3}
        marginTop={0}
        flexWrap="nowrap"
      >
        <Text color={theme.colors.textPrimary} bold>STATUS </Text>
        <Text color={health.color} bold>{health.text}</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={theme.colors.textSecondary}>{servicesRunning}/{servicesTotal}</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={errorsTotal > 0 ? theme.colors.stopped : theme.colors.running} bold>{errorsTotal} err</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={theme.colors.textMuted}>{uptime}</Text>
      </Box>
    );
  }

  // Full dashboard panel
  return (
    <Box 
      borderStyle="round" 
      borderColor={theme.colors.borderDefault} 
      borderBackgroundColor={theme.colors.canvas}
      backgroundColor={theme.colors.surface}
      flexDirection="column" 
      justifyContent="space-between"
      paddingX={1}
      paddingY={0}
      width={panelWidth}
      height={height ?? 8}
      marginTop={0}
    >
      {/* Header */}
      <Box marginBottom={0} justifyContent="space-between" flexWrap="nowrap">
        <Text color={theme.colors.textSecondary} bold>ORCHESTRATION</Text>
        <Text color={theme.colors.textMuted}>v1.0.0</Text>
      </Box>

      {/* Row 1: Health State */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap">
        <Box width={10} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Health</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={health.color} bold>{health.text}</Text>
        </Box>
      </Box>

      {/* Row 2: Active Services */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap">
        <Box width={10} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Services</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={theme.colors.textPrimary} bold>{servicesRunning}</Text>
          <Text color={theme.colors.textSecondary}> / {servicesTotal} active</Text>
        </Box>
      </Box>

      {/* Row 3: Session Uptime */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        <Box width={10} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Uptime</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={theme.colors.textPrimary}>{uptime}</Text>
        </Box>
      </Box>

      {/* Row 4: Total Process Errors */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        <Box width={10} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Errors</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={errorsTotal > 0 ? theme.colors.stopped : theme.colors.running} bold>
            {errorsTotal > 0 ? `${errorsTotal} err` : '0 ok'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
});

export default SystemPanel;
