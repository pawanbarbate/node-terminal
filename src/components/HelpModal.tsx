import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface HelpModalProps {
  onClose?: () => void;
  width?: number;
  height?: number;
}

export const HelpModal: React.FC<HelpModalProps> = React.memo(({ onClose, width = 70 }) => {
  const modalWidth = Math.min(width, 70);

  return (
    <Box 
      borderStyle="round" 
      borderColor={theme.colors.borderFocus} 
      borderBackgroundColor={theme.colors.canvas}
      flexDirection="column" 
      paddingX={2} 
      paddingY={1}
      width={modalWidth}
      backgroundColor={theme.colors.surface}
    >
      {/* Title */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color={theme.colors.accent} bold>DevPulse — Keyboard Shortcuts & Controls</Text>
      </Box>

      {/* Shortcuts List */}
      <Box flexDirection="column" marginBottom={1}>
        <Box justifyContent="space-between">
          <Text color={theme.colors.textPrimary} bold>↑ / ↓  or  j / k</Text>
          <Text color={theme.colors.textSecondary}>Navigate services in left sidebar</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.textPrimary} bold>Enter</Text>
          <Text color={theme.colors.textSecondary}>Focus & view service details / logs</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.accent} bold>r</Text>
          <Text color={theme.colors.textSecondary}>Restart selected service</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.stopped} bold>s</Text>
          <Text color={theme.colors.textSecondary}>Stop or Start selected service</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color="#A78BFA" bold>1  2  3  4  /  ← →</Text>
          <Text color={theme.colors.textSecondary}>Switch tabs (Logs, Errors, Metrics, Env)</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.accent} bold>/</Text>
          <Text color={theme.colors.textSecondary}>Search & filter global log messages</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.warning} bold>f</Text>
          <Text color={theme.colors.textSecondary}>Cycle service filter dropdown</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.running} bold>l  or  Space</Text>
          <Text color={theme.colors.textSecondary}>Toggle Live streaming logs</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.textPrimary} bold>t  or  Tab</Text>
          <Text color={theme.colors.textSecondary}>Toggle active panel focus</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.accent} bold>PgUp / PgDn / [ ]</Text>
          <Text color={theme.colors.textSecondary}>Scroll logs history (Home/End)</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text color={theme.colors.textSecondary} bold>q  /  Ctrl+C</Text>
          <Text color={theme.colors.textSecondary}>Exit DevPulse TUI</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box justifyContent="center" marginTop={1}>
        <Text color={theme.colors.textMuted}>Press </Text>
        <Text color={theme.colors.accent} bold>ESC</Text>
        <Text color={theme.colors.textMuted}> or </Text>
        <Text color={theme.colors.accent} bold>?</Text>
        <Text color={theme.colors.textMuted}> to return to workspace</Text>
      </Box>
    </Box>
  );
});

export default HelpModal;
