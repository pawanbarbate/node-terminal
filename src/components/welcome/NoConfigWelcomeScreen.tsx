import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header } from '../Header.js';
import { ClickProvider, Clickable, ClickManagerContextValue } from '../common/ClickManager.js';
import { useTerminalViewport } from '../../hooks/useTerminalViewport.js';
import { theme } from '../../theme/theme.js';

export interface NoConfigWelcomeScreenProps {
  onCreateNew: () => void;
  onCancel: () => void;
  width?: number;
  height?: number;
}

export const NoConfigWelcomeScreen: React.FC<NoConfigWelcomeScreenProps> = ({
  onCreateNew,
  onCancel,
  width: propWidth,
  height: propHeight
}) => {
  const viewport = useTerminalViewport(propWidth, propHeight);
  const clickManagerRef = useRef<ClickManagerContextValue | null>(null);

  const [time, setTime] = useState(() => new Date().toTimeString().split(' ')[0] || '12:00:00');
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toTimeString().split(' ')[0] || '12:00:00');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useInput((input, key) => {
    // SGR Mouse reporting handling
    if (
      input &&
      (input.includes('[<') ||
        input.includes('\x1b[<') ||
        /\[?<\d+;\d+;\d+[Mm]/.test(input))
    ) {
      const sgrRegex = /(?:\x1b)?\[?<(\d+);(\d+);(\d+)([Mm])/g;
      let match: RegExpExecArray | null;
      while ((match = sgrRegex.exec(input)) !== null) {
        const button = parseInt(match[1] || '0', 10);
        const mouseX = parseInt(match[2] || '0', 10);
        const mouseY = parseInt(match[3] || '0', 10);
        const isPress = match[4] === 'M';
        const baseButton = button & ~28;

        if (baseButton === 0 && isPress) {
          clickManagerRef.current?.dispatchClick(mouseX, mouseY);
        }
      }
      return;
    }

    if (key.return || input === 'c' || input === 'C' || input === ' ') {
      onCreateNew();
      return;
    }

    if (key.escape || input === 'q' || input === 'Q') {
      onCancel();
      return;
    }
  });

  const cardWidth = Math.min(68, Math.max(38, viewport.width - 6));

  return (
    <ClickProvider clickManagerRef={clickManagerRef}>
      <Box 
        flexDirection="column" 
        width={viewport.width} 
        height={viewport.height} 
        backgroundColor={theme.colors.canvas}
        justifyContent="space-between"
      >
        {/* Header */}
        <Header 
          time={time} 
          systemStatus="No Config" 
          statusColor={theme.colors.textMuted}
          width={viewport.width} 
        />

        {/* Center Welcome Card */}
        <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
          <Box 
            borderStyle="round" 
            borderColor={theme.colors.borderFocus} 
            borderBackgroundColor={theme.colors.canvas}
            backgroundColor={theme.colors.surface}
            flexDirection="column" 
            alignItems="center"
            paddingX={3} 
            paddingY={1}
            width={cardWidth}
          >
            <Box marginBottom={1} flexDirection="row" alignItems="center">
              <Text color={theme.colors.accent} bold>~^v~ DevPulse</Text>
              <Text color={theme.colors.textSecondary}> — Workspace Setup</Text>
            </Box>

            <Box marginBottom={1} flexDirection="column" alignItems="center">
              <Text color={theme.colors.textSecondary}>
                No DevPulse configuration file was found in:
              </Text>
              <Text color={theme.colors.accent} bold wrap="truncate-middle">
                {process.cwd()}
              </Text>
            </Box>

            <Box marginY={1}>
              <Clickable onClick={onCreateNew}>
                <Box 
                  backgroundColor={theme.colors.accentDark} 
                  borderStyle="round"
                  borderColor={theme.colors.accent}
                  borderBackgroundColor={theme.colors.surface}
                  paddingX={2}
                  paddingY={0}
                >
                  <Text color={theme.colors.accent} bold>
                    [+ Create New Configuration File]
                  </Text>
                </Box>
              </Clickable>
            </Box>

            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text color={theme.colors.textMuted}>
                Press <Text color={theme.colors.accent} bold>Enter</Text> or click the button to start the setup wizard
              </Text>
              <Text color={theme.colors.textDim}>
                Press <Text color={theme.colors.textSecondary}>Esc</Text> or <Text color={theme.colors.textSecondary}>q</Text> to exit
              </Text>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box 
          flexDirection="row" 
          justifyContent="space-between" 
          alignItems="center" 
          width="100%" 
          backgroundColor={theme.colors.canvas} 
          paddingX={1}
        >
          <Text color={theme.colors.textMuted}>DevPulse v1.0.0</Text>
          <Text color={theme.colors.textDim}>Enter: Create Config  │  Esc/q: Exit</Text>
        </Box>
      </Box>
    </ClickProvider>
  );
};

export default NoConfigWelcomeScreen;

