import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConfigFileSummary } from '../../services/configManager.js';
import { Header } from '../Header.js';
import { ClickProvider, Clickable, ClickManagerContextValue } from '../common/ClickManager.js';
import { useTerminalViewport } from '../../hooks/useTerminalViewport.js';
import { theme } from '../../theme/theme.js';

export interface ConfigSelectorScreenProps {
  configs: ConfigFileSummary[];
  onSelect: (configPath: string) => void;
  onNewConfig: () => void;
  onCancel: () => void;
  width?: number;
  height?: number;
}

export const ConfigSelectorScreen: React.FC<ConfigSelectorScreenProps> = ({
  configs,
  onSelect,
  onNewConfig,
  onCancel,
  width: propWidth,
  height: propHeight
}) => {
  const viewport = useTerminalViewport(propWidth, propHeight);
  const clickManagerRef = useRef<ClickManagerContextValue | null>(null);

  // Live clock timer for Header
  const [time, setTime] = useState(() => new Date().toTimeString().split(' ')[0] || '12:00:00');
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toTimeString().split(' ')[0] || '12:00:00');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Assert SGR mouse reporting mode on mount
  useEffect(() => {
    try {
      process.stdout.write('\x1b[?1000h\x1b[?1006h');
    } catch {}
  }, []);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard navigation & SGR mouse handling
  useInput((input, key) => {
    // 1. SGR Mouse parser
    if (
      input &&
      (input.includes('[<') ||
        input.includes('\x1b[<') ||
        /\[?<\d+;\d+;\d+[Mm]/.test(input))
    ) {
      const sgrRegex = /(?:\x1b)?\[?<(\d+);(\d+);(\d+)([Mm])/g;
      let match: RegExpExecArray | null;
      let handledMouse = false;

      while ((match = sgrRegex.exec(input)) !== null) {
        handledMouse = true;
        const button = parseInt(match[1] || '0', 10);
        const mouseX = parseInt(match[2] || '0', 10);
        const mouseY = parseInt(match[3] || '0', 10);
        const isPress = match[4] === 'M';
        const baseButton = button & ~28;

        if (baseButton === 0 && isPress) {
          clickManagerRef.current?.dispatchClick(mouseX, mouseY);
        }
      }

      if (handledMouse) return;
    }

    // 2. Escape: Exit application
    if (key.escape) {
      onCancel();
      return;
    }

    // 3. Arrow Up / k
    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      return;
    }

    // 4. Arrow Down / j
    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(configs.length - 1, prev + 1));
      return;
    }

    // 5. Enter / Space: Select focused config
    if (key.return || input === ' ') {
      if (configs[selectedIndex]) {
        onSelect(configs[selectedIndex]!.path);
      }
      return;
    }

    // 6. Direct number keys 1-9
    if (/^[1-9]$/.test(input)) {
      const idx = parseInt(input, 10) - 1;
      if (configs[idx]) {
        onSelect(configs[idx]!.path);
      }
      return;
    }

    // 7. 'w' or 'n': Launch Setup Wizard for new config
    if (input === 'w' || input === 'W' || input === 'n' || input === 'N') {
      onNewConfig();
      return;
    }
  });

  const contentHeight = Math.max(14, viewport.height - 3);
  const containerWidth = Math.min(viewport.width, 100);

  return (
    <ClickProvider clickManagerRef={clickManagerRef}>
      <Box
        flexDirection="column"
        width={viewport.width}
        height={viewport.height}
        backgroundColor={theme.colors.canvas}
      >
        {/* Top Header */}
        <Header time={time} systemStatus="Select Configuration Profile" width={viewport.width} />

        {/* Centered Selector Surface */}
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="flex-start"
          width="100%"
          height={contentHeight}
          paddingTop={1}
        >
          <Box
            flexDirection="column"
            width={containerWidth}
            borderStyle="round"
            borderColor={theme.colors.borderDefault}
            backgroundColor={theme.colors.surface}
            paddingX={2}
            paddingY={1}
          >
            {/* Title Section */}
            <Box flexDirection="row" alignItems="center" marginBottom={1}>
              <Text color={theme.colors.accent} bold>⚡ MULTIPLE CONFIGURATIONS DETECTED</Text>
              <Text color={theme.colors.textDim}> │ </Text>
              <Text color={theme.colors.textSecondary}>
                Found {configs.length} profiles in current workspace
              </Text>
            </Box>

            <Text color={theme.colors.textMuted}>
              Select a configuration profile to boot services into DevPulse Dashboard:
            </Text>

            {/* List of Available Configurations */}
            <Box flexDirection="column" marginTop={1} marginBottom={1}>
              {configs.map((cfg, idx) => {
                const isSelected = selectedIndex === idx;
                const quickKey = idx < 9 ? String(idx + 1) : null;

                return (
                  <Clickable
                    key={cfg.path}
                    id={`config-card-${idx}`}
                    onClick={() => {
                      setSelectedIndex(idx);
                      onSelect(cfg.path);
                    }}
                  >
                    <Box
                      flexDirection="column"
                      borderStyle="round"
                      borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderSubtle}
                      backgroundColor={isSelected ? theme.colors.cardHover : theme.colors.card}
                      paddingX={1}
                      paddingY={0}
                      marginBottom={1}
                    >
                      {/* Top Line: Quick Key, Filename, Services Badge */}
                      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
                        <Box flexDirection="row" alignItems="center">
                          {isSelected ? (
                            <Text color={theme.colors.accent} bold>▶ </Text>
                          ) : (
                            <Text color={theme.colors.textMuted}>  </Text>
                          )}

                          {quickKey && (
                            <Box
                              backgroundColor={isSelected ? theme.colors.surface : theme.colors.card}
                              paddingX={1}
                              marginRight={1}
                            >
                              <Text color={isSelected ? theme.colors.accent : theme.colors.textSecondary} bold>
                                [{quickKey}]
                              </Text>
                            </Box>
                          )}

                          <Text color={theme.colors.textPrimary} bold>
                            {cfg.filename}
                          </Text>

                          <Text color={theme.colors.textDim}> │ </Text>
                          <Text color={theme.colors.textSecondary}>
                            {cfg.name}
                          </Text>
                        </Box>

                        <Box flexDirection="row" alignItems="center">
                          {cfg.isValid ? (
                            <Box backgroundColor={theme.colors.runningBg} paddingX={1}>
                              <Text color={theme.colors.running} bold>
                                {cfg.servicesCount} {cfg.servicesCount === 1 ? 'service' : 'services'}
                              </Text>
                            </Box>
                          ) : (
                            <Box backgroundColor={theme.colors.stoppedBg} paddingX={1}>
                              <Text color={theme.colors.stopped} bold>
                                ✖ Invalid JSON
                              </Text>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Bottom Line: Services and Ports preview */}
                      {cfg.isValid && cfg.services.length > 0 && (
                        <Box flexDirection="row" alignItems="center" marginTop={0} paddingLeft={2} flexWrap="wrap">
                          <Text color={theme.colors.textMuted}>Services: </Text>
                          {cfg.services.slice(0, 5).map((svc, sIdx) => (
                            <Box key={sIdx} marginRight={1}>
                              <Text color={theme.colors.accent}>
                                {svc.name}
                                {svc.port ? <Text color={theme.colors.warning}>:{svc.port}</Text> : ''}
                              </Text>
                            </Box>
                          ))}
                          {cfg.services.length > 5 && (
                            <Text color={theme.colors.textDim}>+{cfg.services.length - 5} more</Text>
                          )}
                        </Box>
                      )}

                      {cfg.error && (
                        <Box paddingLeft={2}>
                          <Text color={theme.colors.stopped}>{cfg.error}</Text>
                        </Box>
                      )}
                    </Box>
                  </Clickable>
                );
              })}
            </Box>

            {/* Quick Actions Bar */}
            <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1} paddingTop={1} borderStyle="single" borderColor={theme.colors.borderSubtle}>
              <Clickable id="action-launch" onClick={() => configs[selectedIndex] && onSelect(configs[selectedIndex]!.path)}>
                <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={2}>
                  <Text color={theme.colors.accent} bold>▶ Launch Profile (Enter)</Text>
                </Box>
              </Clickable>

              <Clickable id="action-new-wizard" onClick={onNewConfig}>
                <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={2}>
                  <Text color={theme.colors.textPrimary} bold>+ New Profile (w)</Text>
                </Box>
              </Clickable>

              <Clickable id="action-exit" onClick={onCancel}>
                <Box backgroundColor={theme.colors.card} paddingX={1}>
                  <Text color={theme.colors.textMuted}>✖ Exit (Esc)</Text>
                </Box>
              </Clickable>
            </Box>
          </Box>
        </Box>

        {/* Footer Keybinding Cheatsheet */}
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
          paddingX={1}
          backgroundColor={theme.colors.canvas}
        >
          <Box flexDirection="row" alignItems="center">
            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.accent} bold>Click / ↑↓</Text>
            </Box>
            <Text color={theme.colors.textMuted}>Select </Text>

            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>Enter / 1-9</Text>
            </Box>
            <Text color={theme.colors.textMuted}>Launch </Text>

            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textPrimary} bold>w</Text>
            </Box>
            <Text color={theme.colors.textMuted}>New Profile </Text>

            <Box backgroundColor={theme.colors.card} paddingX={1} marginRight={1}>
              <Text color={theme.colors.textMuted}>Esc</Text>
            </Box>
            <Text color={theme.colors.textMuted}>Exit</Text>
          </Box>

          <Box flexDirection="row" alignItems="center">
            <Text color={theme.colors.accent}>● </Text>
            <Text color={theme.colors.textMuted}>DevPulse Profile Selector</Text>
          </Box>
        </Box>
      </Box>
    </ClickProvider>
  );
};

export default ConfigSelectorScreen;

