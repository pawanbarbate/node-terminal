import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface ProgressBarProps {
  percent?: number;
  color?: string;
  width?: number;
  showBracket?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  percent = 0,
  color = theme.colors.running,
  width = 8,
  showBracket = true
}) => {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const totalSteps = Math.max(2, width);
  const filled = Math.min(totalSteps, Math.max(0, Math.round((safePercent / 100) * totalSteps)));

  let filledStr = '';
  let emptyStr = '';

  if (filled === 0) {
    emptyStr = '─'.repeat(totalSteps);
  } else if (filled >= totalSteps) {
    filledStr = '━'.repeat(totalSteps);
  } else {
    filledStr = '━'.repeat(filled - 1) + '╸';
    emptyStr = '─'.repeat(totalSteps - filled);
  }

  return (
    <Box flexDirection="row" flexWrap="nowrap" alignItems="center">
      {showBracket && <Text color={theme.colors.borderDefault}>[</Text>}
      <Text color={color}>{filledStr}</Text>
      <Text color={theme.colors.borderDefault}>{emptyStr}</Text>
      {showBracket && <Text color={theme.colors.borderDefault}>]</Text>}
    </Box>
  );
});

export default ProgressBar;
