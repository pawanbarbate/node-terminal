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
  const containerWidth = Math.min(Math.max(68, viewport.width - 6), 90);
  const innerWidth = Math.max(20, containerWidth - 6);

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
            paddingY={0}
          >
            {/* Title Section with Hairline Divider */}
            <Box width="100%" flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={0} marginBottom={0} flexWrap="nowrap">
              <Box flexDirection="row" alignItems="center" flexShrink={1}>
                <Text color={theme.colors.accent} bold>⚡ MULTIPLE CONFIGURATIONS DETECTED</Text>
                <Text color={theme.colors.textDim}> │ </Text>
                <Text color={theme.colors.textSecondary}>
                  Found <Text color={theme.colors.textPrimary} bold>{configs.length}</Text> profiles
                </Text>
              </Box>
              <Box flexShrink={0} marginLeft={2}>
                <Text color={theme.colors.textMuted}>[↑↓ / 1-9 to pick]</Text>
              </Box>
            </Box>

            {/* Hairline Divider under Header */}
            <Box width="100%" height={1} overflow="hidden" marginBottom={1}>
              <Text color={theme.colors.borderSubtle}>{'─'.repeat(innerWidth)}</Text>
            </Box>

            {/* List of Available Configurations */}
            <Box flexDirection="column" marginBottom={1}>
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
                      width="100%"
                      flexDirection="column"
                      borderStyle="round"
                      borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderDefault}
                      backgroundColor={isSelected ? theme.colors.card : theme.colors.surface}
                      paddingX={1}
                      paddingY={0}
                      marginBottom={1}
                    >
                      {/* Top Line: Indicator, Shortcut, Filename, Services Count */}
                      <Box width="100%" flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
                        <Box flexDirection="row" alignItems="center" flexShrink={1}>
                          <Text color={isSelected ? theme.colors.accent : theme.colors.textDim} bold={isSelected}>
                            {isSelected ? '▎ ' : '  '}
                          </Text>

                          {quickKey && (
                            <Text color={isSelected ? theme.colors.accent : theme.colors.textMuted} bold={isSelected}>
                              [{quickKey}]{' '}
                            </Text>
                          )}

                          <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary} bold={isSelected} wrap="truncate-end">
                            {cfg.filename}
                          </Text>

                          {cfg.name && cfg.name !== 'services' && cfg.name !== cfg.filename.replace(/\.devpulse\.json$/, '') ? (
                            <Text color={theme.colors.textDim}> · {cfg.name}</Text>
                          ) : null}
                        </Box>

                        <Box flexShrink={0} marginLeft={2}>
                          {cfg.isValid ? (
                            <Text color={isSelected ? theme.colors.running : theme.colors.textMuted} bold={isSelected}>
                              ● {cfg.servicesCount} {cfg.servicesCount === 1 ? 'service' : 'services'}
                            </Text>
                          ) : (
                            <Text color={theme.colors.stopped} bold>
                              ✖ Invalid configuration
                            </Text>
                          )}
                        </Box>
                      </Box>

                      {/* Bottom Line: Included Services & Ports (Clean dot-separated list) */}
                      {cfg.isValid && cfg.services.length > 0 && (
                        <Box width="100%" flexDirection="row" alignItems="center" marginTop={0} flexWrap="nowrap">
                          <Text color={theme.colors.textDim}>    Services: </Text>
                          <Box flexDirection="row" alignItems="center" flexShrink={1} flexWrap="nowrap">
                            {cfg.services.slice(0, 5).map((svc, sIdx) => (
                              <Box key={sIdx} marginRight={1} flexShrink={0}>
                                <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary}>
                                  {svc.name}
                                </Text>
                                {svc.port ? <Text color={theme.colors.accent}>:{svc.port}</Text> : null}
                                {sIdx < Math.min(cfg.services.length, 5) - 1 ? (
                                  <Text color={theme.colors.textDim}> ·</Text>
                                ) : null}
                              </Box>
                            ))}
                            {cfg.services.length > 5 && (
                              <Text color={theme.colors.textDim}>+{cfg.services.length - 5} more</Text>
                            )}
                          </Box>
                        </Box>
                      )}

                      {cfg.isValid && cfg.services.length === 0 && (
                        <Box width="100%" marginTop={0}>
                          <Text color={theme.colors.textDim}>    No services configured</Text>
                        </Box>
                      )}

                      {cfg.error && (
                        <Box width="100%" marginTop={0}>
                          <Text color={theme.colors.stopped}>    {cfg.error}</Text>
                        </Box>
                      )}
                    </Box>
                  </Clickable>
                );
              })}
            </Box>

            {/* Hairline Divider above Actions */}
            <Box width="100%" height={1} overflow="hidden" marginBottom={1}>
              <Text color={theme.colors.borderSubtle}>{'─'.repeat(innerWidth)}</Text>
            </Box>

            {/* Quick Actions Bar - Frameless Integrated Design */}
            <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
              <Box flexDirection="row" alignItems="center">
                <Clickable id="action-launch" onClick={() => configs[selectedIndex] && onSelect(configs[selectedIndex]!.path)}>
                  <Box backgroundColor={theme.colors.accent} paddingX={2} marginRight={2}>
                    <Text color={theme.colors.canvas} bold>▶ Launch Profile (Enter)</Text>
                  </Box>
                </Clickable>

                <Clickable id="action-new-wizard" onClick={onNewConfig}>
                  <Box backgroundColor={theme.colors.card} paddingX={2}>
                    <Text color={theme.colors.textPrimary} bold>+ New Profile (w)</Text>
                  </Box>
                </Clickable>
              </Box>

              <Clickable id="action-exit" onClick={onCancel}>
                <Box backgroundColor={theme.colors.card} paddingX={2}>
                  <Text color={theme.colors.textMuted}>✕ Exit (Esc)</Text>
                </Box>
              </Clickable>
            </Box>
          </Box>
        </Box>

        {/* Footer Keybinding Cheatsheet matching DevPulse bracket style */}
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
          paddingX={1}
          backgroundColor={theme.colors.canvas}
        >
          <Box flexDirection="row" alignItems="center" flexWrap="nowrap">
            <Box marginRight={2}><Text color={theme.colors.accent} bold>[↑↓/Click]</Text><Text color={theme.colors.textMuted}> Select</Text></Box>
            <Box marginRight={2}><Text color={theme.colors.textPrimary} bold>[Enter/1-9]</Text><Text color={theme.colors.textMuted}> Launch</Text></Box>
            <Box marginRight={2}><Text color={theme.colors.textPrimary} bold>[w]</Text><Text color={theme.colors.textMuted}> New Profile</Text></Box>
            <Box marginRight={2}><Text color={theme.colors.textDim} bold>[Esc]</Text><Text color={theme.colors.textMuted}> Exit</Text></Box>
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

