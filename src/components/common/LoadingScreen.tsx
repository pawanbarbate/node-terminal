import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from '../ProgressBar.js';
import { useSpinner } from '../../hooks/useSpinner.js';
import { theme } from '../../theme/theme.js';

export interface LoadingScreenProps {
  progress?: number;
  statusText?: string;
  width?: number;
  height?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = React.memo(({
  progress = 0,
  statusText = 'Scanning workspace for configuration profiles...',
  width = 80,
  height = 24
}) => {
  const spinner = useSpinner(true, 80);
  const cardWidth = Math.min(54, Math.max(36, width - 8));
  const barWidth = Math.max(12, cardWidth - 8);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
      backgroundColor={theme.colors.canvas}
    >
      <Box
        flexDirection="column"
        width={cardWidth}
        borderStyle="round"
        borderColor={theme.colors.borderDefault}
        borderBackgroundColor={theme.colors.canvas}
        backgroundColor={theme.colors.surface}
        paddingX={2}
        paddingY={1}
      >
        {/* Header / Brand */}
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" marginBottom={1}>
          <Box flexDirection="row" alignItems="center">
            <Text color={theme.colors.accent} bold>~^v~ </Text>
            <Text color={theme.colors.textPrimary} bold>DevPulse</Text>
          </Box>
          <Text color={theme.colors.accent} bold>{spinner}</Text>
        </Box>

        {/* Progress Bar with Percentage */}
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" marginY={1}>
          <ProgressBar
            percent={progress}
            width={barWidth - 6}
            color={theme.colors.accent}
          />
          <Text color={theme.colors.accent} bold> {String(Math.round(progress)).padStart(3, ' ')}%</Text>
        </Box>

        {/* Status text */}
        <Box flexDirection="row" alignItems="center" marginTop={1}>
          <Text color={theme.colors.textMuted} wrap="truncate-end">
            {statusText}
          </Text>
        </Box>
      </Box>
    </Box>
  );
});

export default LoadingScreen;

