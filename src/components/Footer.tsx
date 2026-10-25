import React from 'react';
import { Box, Text } from 'ink';
import { ActivePanel } from '../types/index.js';
import Clickable from './common/ClickManager.js';
import { theme } from '../theme/theme.js';

export interface FooterProps {
  isConnected?: boolean;
  activePanel?: ActivePanel;
  width?: number;
  onToggleHelp?: () => void;
}

export const Footer: React.FC<FooterProps> = React.memo(({ 
  isConnected = true, 
  activePanel = 'services', 
  width = 120,
  onToggleHelp
}) => {
  const isNarrow = width < 85;

  return (
    <Box 
      flexDirection="row" 
      justifyContent="space-between" 
      alignItems="center" 
      width="100%" 
      backgroundColor={theme.colors.canvas}
      marginTop={0} 
      paddingX={1}
      flexWrap="nowrap"
    >
      {/* Left keyboard shortcuts with elevated keycaps */}
      <Box flexDirection="row" alignItems="center" flexShrink={1}>
        <Clickable onClick={() => onToggleHelp?.()} flexDirection="row">
          <Box backgroundColor={theme.colors.accentDark} paddingX={1} marginRight={1}>
            <Text color={theme.colors.accent} bold>?</Text>
          </Box>
          <Text color={theme.colors.textSecondary}>Help </Text>
        </Clickable>

        <Text color={theme.colors.textMuted}>↑↓ </Text>
        <Text color={theme.colors.textSecondary}>{activePanel === 'services' ? 'Nav ' : 'Scroll '}</Text>

        {!isNarrow && (
          <>
            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>Enter</Text>
            </Box>
            <Text color={theme.colors.textSecondary}>Logs </Text>
          </>
        )}

        <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
          <Text color={theme.colors.textPrimary} bold>r</Text>
        </Box>
        <Text color={theme.colors.textSecondary}>Restart </Text>

        <Box backgroundColor={theme.colors.stoppedBg} paddingX={1} marginRight={1}>
          <Text color={theme.colors.stopped} bold>s</Text>
        </Box>
        <Text color={theme.colors.stopped}>Run/Stop </Text>

        {!isNarrow && (
          <>
            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>/</Text>
            </Box>
            <Text color={theme.colors.textSecondary}>Search </Text>

            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>f</Text>
            </Box>
            <Text color={theme.colors.textSecondary}>Filter </Text>
          </>
        )}

        <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
          <Text color={theme.colors.textPrimary} bold>t</Text>
        </Box>
        <Text color={theme.colors.textSecondary}>Panel </Text>
      </Box>

      {/* Right connection indicator */}
      <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
        <Text color={isConnected ? theme.colors.running : theme.colors.stopped}>● </Text>
        <Text color={isConnected ? theme.colors.running : theme.colors.stopped} bold>
          {isConnected ? 'Connected' : 'Offline'}
        </Text>
      </Box>
    </Box>
  );
});

export default Footer;
