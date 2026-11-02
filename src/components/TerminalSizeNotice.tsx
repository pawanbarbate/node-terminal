import React from 'react';
import { Box, Text } from 'ink';
import { MIN_TERMINAL_HEIGHT, MIN_TERMINAL_WIDTH } from '../hooks/useTerminalViewport.js';
import { theme } from '../theme/theme.js';

export interface TerminalSizeNoticeProps {
  width: number;
  height: number;
}

export const TerminalSizeNotice: React.FC<TerminalSizeNoticeProps> = ({ width, height }) => (
  <Box
    width={width}
    height={height}
    flexDirection="column"
    justifyContent="center"
    paddingX={1}
    backgroundColor={theme.colors.canvas}
  >
    <Text color={theme.colors.warning} bold>Terminal is too small for the interactive interface.</Text>
    <Text color={theme.colors.textSecondary}>
      Resize to at least {MIN_TERMINAL_WIDTH} columns by {MIN_TERMINAL_HEIGHT} rows.
    </Text>
    <Text color={theme.colors.textMuted}>Current size: {width} columns by {height} rows.</Text>
  </Box>
);

export default TerminalSizeNotice;
