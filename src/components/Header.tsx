import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface HeaderProps {
  time?: string;
  systemStatus?: string;
  width?: number;
}

export const Header: React.FC<HeaderProps> = React.memo(({ 
  time = '10:24:17', 
  systemStatus = 'All Systems Running',
  width = 120
}) => {
  const isNarrow = width < 95;
  const isVeryNarrow = width < 75;

  return (
    <Box 
      flexDirection="row" 
      justifyContent="space-between" 
      alignItems="center" 
      width="100%" 
      backgroundColor={theme.colors.canvas}
      marginBottom={0}
      paddingX={1}
      flexWrap="nowrap"
    >
      {/* Left branding */}
      <Box flexDirection="row" alignItems="center" flexShrink={0}>
        <Text color={theme.colors.accent} bold>~^v~ </Text>
        <Text color={theme.colors.textPrimary} bold>DevPulse</Text>
        {!isNarrow && (
          <Text color={theme.colors.textMuted}>  │  Local Development Workspace</Text>
        )}
      </Box>

      {/* Right status */}
      <Box flexDirection="row" alignItems="center" flexShrink={0}>
        {!isVeryNarrow && (
          <>
            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textSecondary}>v0.1.0</Text>
            </Box>
            <Text color={theme.colors.textDim}>│ </Text>
          </>
        )}
        <Text color={theme.colors.textSecondary}>🕒 {time}</Text>
        <Text color={theme.colors.textDim}> │ </Text>
        <Text color={theme.colors.running}>● </Text>
        <Text color={theme.colors.running} bold>
          {isNarrow 
            ? (systemStatus === 'All Systems Running' ? 'Running' : systemStatus.replace('Workspace ', '')) 
            : systemStatus}
        </Text>
      </Box>
    </Box>
  );
});

export default Header;

