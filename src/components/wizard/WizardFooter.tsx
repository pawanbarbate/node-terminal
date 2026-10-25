import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/theme.js';

export interface WizardFooterProps {
  width?: number;
}

export const WizardFooter: React.FC<WizardFooterProps> = React.memo(({ width = 120 }) => {
  const isNarrow = width < 90;
  const isUltraNarrow = width < 75;

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
      {/* Left shortcut chips */}
      <Box flexDirection="row" alignItems="center" flexShrink={1}>
        <Box backgroundColor={theme.colors.accentDark} paddingX={1} marginRight={1}>
          <Text color={theme.colors.accent} bold>Click</Text>
        </Box>
        <Text color={theme.colors.textMuted}>Select/Focus </Text>

        <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
          <Text color={theme.colors.textPrimary} bold>Tab</Text>
        </Box>
        <Text color={theme.colors.textMuted}>Switch </Text>

        {!isUltraNarrow && (
          <>
            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>a</Text>
            </Box>
            <Text color={theme.colors.textMuted}>Add </Text>

            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>d</Text>
            </Box>
            <Text color={theme.colors.textMuted}>Remove </Text>
          </>
        )}

        <Box backgroundColor={theme.colors.runningBg} paddingX={1} marginRight={1}>
          <Text color={theme.colors.running} bold>s</Text>
        </Box>
        <Text color={theme.colors.running}>{isNarrow ? 'Launch ' : 'Save & Launch '}</Text>

        {!isNarrow && (
          <>
            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>Esc</Text>
            </Box>
            <Text color={theme.colors.textMuted}>Discard Changes</Text>
          </>
        )}
      </Box>

      {/* Right mode indicator */}
      <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
        <Text color={theme.colors.accent}>● </Text>
        <Text color={theme.colors.accent} bold>{isNarrow ? 'Setup' : 'Setup Wizard'}</Text>
      </Box>
    </Box>
  );
});

export default WizardFooter;
