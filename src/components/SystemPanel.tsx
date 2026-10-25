import React from 'react';
import { Box, Text } from 'ink';
import ProgressBar from './ProgressBar.js';
import { SystemMetrics } from '../types/index.js';
import { theme } from '../theme/theme.js';

export interface SystemPanelProps {
  metrics?: SystemMetrics;
  panelWidth?: number;
  height?: number;
  isUltraCompact?: boolean;
}

export const SystemPanel: React.FC<SystemPanelProps> = React.memo(({ 
  metrics, 
  panelWidth = 34, 
  height,
  isUltraCompact = false 
}) => {
  const {
    cpu = 32,
    memoryUsed = 1.2,
    memoryTotal = 4.0,
    servicesRunning = 5,
    servicesTotal = 6,
    uptime = '12m 34s',
    errors1h = 3
  } = metrics || {};

  const memoryPercent = Math.round((memoryUsed / memoryTotal) * 100);
  const isNarrow = panelWidth <= 30;
  const barWidth = isNarrow ? 6 : Math.max(8, Math.min(12, panelWidth - 22));

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
        <Text color={theme.colors.textPrimary} bold>SYS </Text>
        <Text color={theme.colors.accent}>{cpu}%</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={theme.colors.running}>{memoryUsed}G</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={theme.colors.textSecondary}>{servicesRunning}/{servicesTotal}</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={theme.colors.textMuted}>{uptime.split(' ')[0]}</Text>
      </Box>
    );
  }

  // Full 8-line dashboard
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
        <Text color={theme.colors.textSecondary} bold>SYSTEM</Text>
        <Text color={theme.colors.textMuted}>v0.1.0</Text>
      </Box>

      {/* Row 1: CPU */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap">
        <Box width={7} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>CPU</Text>
        </Box>
        <Box width={6} flexShrink={0}>
          <Text color={theme.colors.textPrimary}>{cpu}%</Text>
        </Box>
        <Box flexGrow={1} flexShrink={0} justifyContent="flex-end">
          <ProgressBar percent={cpu} color={theme.colors.accent} width={barWidth} />
        </Box>
      </Box>

      {/* Row 2: Memory */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap">
        <Box width={7} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Memory</Text>
        </Box>
        <Box width={6} flexShrink={0}>
          <Text color={theme.colors.textPrimary}>{memoryUsed}G</Text>
        </Box>
        <Box flexGrow={1} flexShrink={0} justifyContent="flex-end">
          <ProgressBar percent={memoryPercent} color={theme.colors.running} width={barWidth} />
        </Box>
      </Box>

      {/* Row 3: Active Services */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap">
        <Box width={7} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Active</Text>
        </Box>
        <Box width={6} flexShrink={0}>
          <Text color={theme.colors.textPrimary}>{servicesRunning}/{servicesTotal}</Text>
        </Box>
        <Box flexGrow={1} flexShrink={0} justifyContent="flex-end">
          <Text color={servicesRunning === servicesTotal ? theme.colors.running : theme.colors.warning}>
            {servicesRunning === servicesTotal ? '● Healthy' : '▲ Degraded'}
          </Text>
        </Box>
      </Box>

      {/* Row 4: Uptime */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        <Box width={7} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Uptime</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={theme.colors.textPrimary}>{uptime}</Text>
        </Box>
      </Box>

      {/* Row 5: Errors (1h) */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        <Box width={7} flexShrink={0}>
          <Text color={theme.colors.textSecondary}>Errors</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={errors1h > 0 ? theme.colors.stopped : theme.colors.running} bold>
            {errors1h > 0 ? `${errors1h} err` : '0 ok'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
});

export default SystemPanel;
