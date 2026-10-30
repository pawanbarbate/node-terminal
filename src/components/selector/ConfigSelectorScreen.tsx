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

type SummaryService = ConfigFileSummary['services'][number];

// Chunk services into display lines that fit the given character budget
function chunkServiceLines(services: SummaryService[], maxChars: number): SummaryService[][] {
  const lines: SummaryService[][] = [];
  let current: SummaryService[] = [];
  let currentLen = 0;
  for (const svc of services) {
    const len = svc.name.length + (svc.port ? String(svc.port).length + 1 : 0);
    const separator = current.length ? 3 : 0; // " · "
    if (current.length && currentLen + separator + len > maxChars) {
      lines.push(current);
      current = [svc];
      currentLen = len;
    } else {
      current.push(svc);
      currentLen += separator + len;
    }
  }
  if (current.length) lines.push(current);
  return lines;
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
      let wheelDelta = 0;

      while ((match = sgrRegex.exec(input)) !== null) {
        handledMouse = true;
        const button = parseInt(match[1] || '0', 10);
        const mouseX = parseInt(match[2] || '0', 10);
        const mouseY = parseInt(match[3] || '0', 10);
        const isPress = match[4] === 'M';
        const baseButton = button & ~28;

        if (baseButton === 0 && isPress) {
          clickManagerRef.current?.dispatchClick(mouseX, mouseY);
        } else if (baseButton === 64 && isPress) {
          wheelDelta = -1;
        } else if (baseButton === 65 && isPress) {
          wheelDelta = 1;
        }
      }

      if (handledMouse) {
        if (wheelDelta !== 0 && configs.length > 0) {
          setSelectedIndex(prev => Math.min(configs.length - 1, Math.max(0, prev + wheelDelta)));
        }
        return;
      }
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

  // ---------------------------------------------------------------
  // Vertical windowing: keep the profile list inside the screen
  // Chrome rows (padding 1 + borders 2 + title 1 + dividers 3 + actions 4) = 11
  // ---------------------------------------------------------------
  const listBudget = Math.max(4, contentHeight - 11);
  const MAX_SELECTED_SERVICE_LINES = 4;
  const INDICATOR_RESERVE = 2; // rows for "▲ above" / "▼ below"

  // Service lines the selected card can afford: base card is 4 rows,
  // so remaining rows (after indicator reserve) go to service lines.
  const fitServiceLines = Math.max(0, Math.min(MAX_SELECTED_SERVICE_LINES, listBudget - 4 - INDICATOR_RESERVE));

  // Wrapped service lines for the selected profile (all services, hard cap 4 lines)
  const selectedCfg = configs[selectedIndex];
  // Reserve room so a trailing "+N more" never overflows the card width
  const serviceLineBudget = Math.max(12, innerWidth - 26);
  const selectedServiceLines: SummaryService[][] = selectedCfg && selectedCfg.isValid
    ? chunkServiceLines(selectedCfg.services, serviceLineBudget)
    : [];
  const visibleServiceLines = selectedServiceLines.slice(0, fitServiceLines);
  let hiddenServiceCount = 0;
  for (let i = fitServiceLines; i < selectedServiceLines.length; i++) {
    hiddenServiceCount += selectedServiceLines[i]?.length ?? 0;
  }

  // Row cost of each card: 2 borders + 1 margin + content rows
  const cardRows = (idx: number): number => {
    const cfg = configs[idx];
    if (!cfg) return 4;
    if (cfg.error) return 5; // top line + error line
    if (idx === selectedIndex) {
      if (cfg.services.length === 0) return 4; // top line + "No services"
      return 4 + visibleServiceLines.length;
    }
    return 4; // top line only (services shown on selected card)
  };

  // Greedy packing around selectedIndex: grow window until budget is spent
  const packWindow = (budget: number): { start: number; end: number; used: number } => {
    let start = configs.length > 0 ? selectedIndex : 0;
    let end = configs.length > 0 ? selectedIndex + 1 : 0;
    let used = configs.length > 0 ? cardRows(selectedIndex) : 0;
    for (;;) {
      let grew = false;
      if (end < configs.length && used + cardRows(end) <= budget) {
        used += cardRows(end);
        end++;
        grew = true;
      }
      if (start > 0 && used + cardRows(start - 1) <= budget) {
        used += cardRows(start - 1);
        start--;
        grew = true;
      }
      if (!grew) break;
    }
    return { start, end, used };
  };

  // Always afford at least the selected card itself, then reserve indicator rows
  const initialBudget = Math.max(cardRows(selectedIndex), listBudget - INDICATOR_RESERVE);
  let packed = packWindow(initialBudget);
  // Second pass: if fewer indicators are actually needed, reclaim their rows
  const actualReserve =
    (packed.start > 0 ? 1 : 0) + (packed.end < configs.length ? 1 : 0);
  if (actualReserve < INDICATOR_RESERVE) {
    const retry = packWindow(Math.max(cardRows(selectedIndex), listBudget - actualReserve));
    if (retry.end - retry.start > packed.end - packed.start) packed = retry;
  }
  const windowStart = packed.start;
  const windowEnd = packed.end;
  const visibleConfigs = configs.slice(windowStart, windowEnd);
  const hiddenAbove = windowStart;
  const hiddenBelow = configs.length - windowEnd;

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

            {/* List of Available Configurations (windowed to fit the screen) */}
            <Box flexDirection="column">
              {hiddenAbove > 0 && (
                <Box width="100%">
                  <Text color={theme.colors.textMuted}>
                    ▲ {hiddenAbove} {hiddenAbove === 1 ? 'profile' : 'profiles'} above
                  </Text>
                </Box>
              )}

              {visibleConfigs.map((cfg, vIdx) => {
                const idx = windowStart + vIdx;
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
                      borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderSubtle}
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

                          <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textMuted} bold={isSelected} wrap="truncate-end">
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

                      {/* Selected Card: ALL services wrapped across up to 4 lines */}
                      {isSelected && cfg.isValid && cfg.services.length > 0 && (
                        <Box width="100%" flexDirection="column" marginTop={0}>
                          {visibleServiceLines.map((line, lineIdx) => (
                            <Box key={lineIdx} width="100%" flexDirection="row" alignItems="center" flexWrap="nowrap">
                              <Text color={theme.colors.textDim}>
                                {lineIdx === 0 ? '    Services: ' : ' '.repeat(14)}
                              </Text>
                              <Box flexDirection="row" alignItems="center" flexShrink={1} flexWrap="nowrap">
                                {line.map((svc, sIdx) => (
                                  <Box key={sIdx} marginRight={1} flexShrink={0}>
                                    <Text color={theme.colors.textPrimary}>
                                      {svc.name}
                                    </Text>
                                    {svc.port ? <Text color={theme.colors.accent}>:{svc.port}</Text> : null}
                                    {sIdx < line.length - 1 ? (
                                      <Text color={theme.colors.textDim}> ·</Text>
                                    ) : null}
                                  </Box>
                                ))}
                                {lineIdx === visibleServiceLines.length - 1 && hiddenServiceCount > 0 && (
                                  <Text color={theme.colors.textDim}>+{hiddenServiceCount} more</Text>
                                )}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {isSelected && cfg.isValid && cfg.services.length === 0 && (
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

              {hiddenBelow > 0 && (
                <Box width="100%">
                  <Text color={theme.colors.textMuted}>
                    ▼ {hiddenBelow} {hiddenBelow === 1 ? 'profile' : 'profiles'} below
                  </Text>
                </Box>
              )}
            </Box>

            {/* Hairline Divider above Actions */}
            <Box width="100%" height={1} overflow="hidden">
              <Text color={theme.colors.borderSubtle}>{'─'.repeat(innerWidth)}</Text>
            </Box>

            {/* Quick Actions Bar - Primary CTA + Text Links */}
            <Box flexDirection="column" width="100%" marginBottom={1}>
              <Clickable id="action-launch" onClick={() => configs[selectedIndex] && onSelect(configs[selectedIndex]!.path)} width="100%">
                <Box
                  backgroundColor={theme.colors.accent}
                  justifyContent="center"
                  alignItems="center"
                  paddingX={1}
                  width="100%"
                >
                  <Text color={theme.colors.canvas} bold>▶ Launch Profile (Enter)</Text>
                </Box>
              </Clickable>

              <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
                <Clickable id="action-new-wizard" onClick={onNewConfig}>
                  <Text color={theme.colors.textPrimary} bold>[+] New Profile (w)</Text>
                </Clickable>

                <Clickable id="action-exit" onClick={onCancel}>
                  <Text color={theme.colors.textMuted}>[✕ Exit (Esc)]</Text>
                </Clickable>
              </Box>
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

