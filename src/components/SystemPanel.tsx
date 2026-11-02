import React from 'react';
import { Box, Text } from 'ink';
import { WorkspaceSummary } from '../types/index.js';
import { theme } from '../theme/theme.js';

export interface SystemPanelProps {
  summary: WorkspaceSummary;
  panelWidth?: number;
  height?: number;
  isUltraCompact?: boolean;
}

export const SystemPanel: React.FC<SystemPanelProps> = React.memo(({
  summary,
  panelWidth = 34,
  height,
  isUltraCompact = false
}) => {
  const isNarrow = panelWidth < 46;
  const serviceLabel = summary.servicesTotal === 0
    ? 'No services configured'
    : `${summary.servicesRunning}/${summary.servicesTotal} running`;
  const serviceColor = summary.servicesTotal === 0
    ? theme.colors.textMuted
    : summary.servicesRunning === summary.servicesTotal
      ? theme.colors.running
      : theme.colors.warning;

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
        <Text color={theme.colors.textPrimary} bold>WORKSPACE </Text>
        <Text color={serviceColor}>{isNarrow
          ? (summary.servicesTotal === 0 ? 'none' : `${summary.servicesRunning}/${summary.servicesTotal}`)
          : serviceLabel}</Text>
        <Text color={theme.colors.textDim}>│</Text>
        <Text color={theme.colors.textMuted}>{summary.uptime}</Text>
      </Box>
    );
  }

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
      <Box justifyContent="space-between" flexWrap="nowrap">
        <Text color={theme.colors.textSecondary} bold>WORKSPACE</Text>
        <Text color={theme.colors.textMuted}>Local processes</Text>
      </Box>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        <Text color={theme.colors.textSecondary}>Services</Text>
        <Text color={serviceColor} bold>{isNarrow
          ? (summary.servicesTotal === 0 ? 'none' : `${summary.servicesRunning}/${summary.servicesTotal}`)
          : serviceLabel}</Text>
      </Box>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
        <Text color={theme.colors.textSecondary}>Dashboard uptime</Text>
        <Text color={theme.colors.textPrimary}>{summary.uptime}</Text>
      </Box>
    </Box>
  );
});

export default SystemPanel;
