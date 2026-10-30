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
  const selectedIndexRef = useRef(0);

  const updateSelection = (index: number) => {
    const nextIndex = Math.max(0, Math.min(configs.length - 1, index));
    selectedIndexRef.current = nextIndex;
    setSelectedIndex(nextIndex);
  };

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
          updateSelection(selectedIndexRef.current + wheelDelta);
        }
        return;
      }
    }

    // 2. Escape: Exit application
    if (key.escape) {
      onCancel();
      return;
    }

    // Keep keyboard movement aligned with the visual grid, including a partial last row.
    if (key.leftArrow || key.rightArrow || key.upArrow || key.downArrow ||
      input === 'h' || input === 'l' || input === 'k' || input === 'j') {
      if (configs.length === 0) return;

      const currentIndex = selectedIndexRef.current;
      const currentColumn = currentIndex % columns;
      const currentRow = Math.floor(currentIndex / columns);
      let nextIndex = currentIndex;

      if (key.leftArrow || input === 'h') {
        if (currentColumn > 0) nextIndex--;
      } else if (key.rightArrow || input === 'l') {
        if (currentColumn < columns - 1 && currentIndex + 1 < configs.length) nextIndex++;
      } else {
        const rowDelta = key.upArrow || input === 'k' ? -1 : 1;
        const targetRow = Math.max(0, Math.min(Math.ceil(configs.length / columns) - 1, currentRow + rowDelta));
        const targetRowStart = targetRow * columns;
        const targetRowLength = Math.min(columns, configs.length - targetRowStart);
        nextIndex = targetRowStart + Math.min(currentColumn, targetRowLength - 1);
      }

      updateSelection(nextIndex);
      return;
    }

    // 5. Enter / Space: Select focused config
    if (key.return || input === ' ') {
      if (configs[selectedIndexRef.current]) {
        onSelect(configs[selectedIndexRef.current]!.path);
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
  const containerWidth = Math.min(90, Math.max(40, viewport.width - 6));
  const innerWidth = Math.max(20, containerWidth - 6);
  const columns = innerWidth >= 76 ? 2 : 1;
  const columnWidth = Math.floor((innerWidth - (columns - 1) * 2) / columns);

  const listBudget = Math.max(4, contentHeight - 11);
  const MAX_SELECTED_SERVICE_LINES = 3;
  const INDICATOR_RESERVE = 2; // rows for "▲ above" / "▼ below"
  const fitServiceLines = Math.max(0, Math.min(MAX_SELECTED_SERVICE_LINES, listBudget - 8 - INDICATOR_RESERVE));
  const selectedCfg = configs[selectedIndex];
  const serviceLineBudget = Math.max(12, columnWidth - 8);
  const selectedServiceLines: SummaryService[][] = selectedCfg && selectedCfg.isValid
    ? chunkServiceLines(selectedCfg.services, serviceLineBudget)
    : [];
  const visibleServiceLines = selectedServiceLines.slice(0, fitServiceLines);
  let hiddenServiceCount = 0;
  for (let i = fitServiceLines; i < selectedServiceLines.length; i++) {
    hiddenServiceCount += selectedServiceLines[i]?.length ?? 0;
  }

  // Each card has a title and summary row, plus borders and its bottom margin.
  const cardRows = (idx: number): number => {
    const cfg = configs[idx];
    if (!cfg) return 5;
    if (cfg.error) return 7;
    if (idx === selectedIndex) {
      if (cfg.services.length === 0) return 7;
      if (visibleServiceLines.length === 0) return 5;
      return 7 + visibleServiceLines.length + (hiddenServiceCount > 0 ? 1 : 0);
    }
    return 5;
  };

  const rowCount = Math.ceil(configs.length / columns);
  const selectedRow = Math.floor(selectedIndex / columns);
  const gridRowHeight = (row: number): number => {
    const first = row * columns;
    return Math.max(...Array.from(
      { length: Math.min(columns, configs.length - first) },
      (_, column) => cardRows(first + column)
    ));
  };

  const packWindow = (budget: number): { start: number; end: number; used: number } => {
    let start = rowCount > 0 ? selectedRow : 0;
    let end = rowCount > 0 ? selectedRow + 1 : 0;
    let used = rowCount > 0 ? gridRowHeight(selectedRow) : 0;
    for (;;) {
      let grew = false;
      if (end < rowCount && used + gridRowHeight(end) <= budget) {
        used += gridRowHeight(end);
        end++;
        grew = true;
      }
      if (start > 0 && used + gridRowHeight(start - 1) <= budget) {
        used += gridRowHeight(start - 1);
        start--;
        grew = true;
      }
      if (!grew) break;
    }
    return { start, end, used };
  };

  const initialBudget = Math.max(gridRowHeight(selectedRow), listBudget - INDICATOR_RESERVE);
  let packed = packWindow(initialBudget);
  const actualReserve =
    (packed.start > 0 ? 1 : 0) + (packed.end < rowCount ? 1 : 0);
  if (actualReserve < INDICATOR_RESERVE) {
    const retry = packWindow(Math.max(gridRowHeight(selectedRow), listBudget - actualReserve));
    if (retry.end - retry.start > packed.end - packed.start) packed = retry;
  }
  const windowStart = packed.start * columns;
  const windowEnd = Math.min(configs.length, packed.end * columns);
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
            {/* Title Section */}
            <Box width="100%" flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" alignItems="center" justifyContent="space-between">
                <Text color={theme.colors.accent} bold>
                  {containerWidth >= 76 ? '⚡ MULTIPLE CONFIGURATIONS DETECTED' : '⚡ SELECT A PROFILE'}
                </Text>
                {containerWidth >= 76 && (
                  <Text color={theme.colors.textMuted}>←↑↓→ navigate · Enter launch</Text>
                )}
              </Box>
              <Text color={theme.colors.textSecondary}>
                <Text color={theme.colors.textPrimary} bold>{configs.length}</Text>
                {' '}{configs.length === 1 ? 'profile' : 'profiles'} available
              </Text>
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

              {Array.from({ length: Math.ceil(visibleConfigs.length / columns) }, (_, row) => (
                <Box key={`config-row-${row}`} flexDirection="row" width="100%">
                  {visibleConfigs.slice(row * columns, (row + 1) * columns).map((cfg, column) => {
                const idx = windowStart + row * columns + column;
                const isSelected = selectedIndex === idx;
                const quickKey = idx < 9 ? String(idx + 1) : null;
                const showConfigName = columns === 1 && innerWidth >= 50;

                return (
                  <Clickable
                    key={cfg.path}
                    id={`config-card-${idx}`}
                    width={`${100 / columns}%`}
                    paddingRight={columns === 2 && column === 0 ? 1 : 0}
                    onClick={() => {
                      updateSelection(idx);
                      onSelect(cfg.path);
                    }}
                  >
                    <Box
                      width="100%"
                      flexDirection="column"
                      borderStyle="round"
                      borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderSubtle}
                      backgroundColor={isSelected ? theme.colors.cardSelected : theme.colors.card}
                      paddingX={1}
                      paddingY={0}
                      marginBottom={1}
                    >
                      <Box width="100%" flexDirection="row" alignItems="center" flexWrap="nowrap">
                        <Text color={isSelected ? theme.colors.accent : theme.colors.textDim} bold={isSelected}>
                          {isSelected ? '◆ ' : '◇ '}
                        </Text>
                        {quickKey && (
                          <Text color={isSelected ? theme.colors.accent : theme.colors.textMuted} bold={isSelected}>
                            [{quickKey}]{' '}
                          </Text>
                        )}
                        <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary} bold={isSelected} wrap="truncate-end">
                          {cfg.filename}
                        </Text>
                      </Box>

                      <Box width="100%" flexDirection="row" paddingLeft={3}>
                        {cfg.isValid ? (
                          <Text color={isSelected ? theme.colors.running : theme.colors.textMuted}>
                            ● {cfg.servicesCount} {cfg.servicesCount === 1 ? 'service' : 'services'}
                            {showConfigName && cfg.name && cfg.name !== 'services' && cfg.name !== cfg.filename.replace(/\.devpulse\.json$/, '')
                              ? <Text color={theme.colors.textDim}> · {cfg.name}</Text>
                              : null}
                          </Text>
                        ) : (
                          <Text color={theme.colors.stopped} bold>✖ Invalid configuration</Text>
                        )}
                      </Box>

                      {isSelected && cfg.isValid && cfg.services.length > 0 && visibleServiceLines.length > 0 && (
                        <Box width="100%" flexDirection="column" marginTop={1} paddingLeft={3}>
                          <Text color={theme.colors.textDim} bold>SERVICES</Text>
                          {visibleServiceLines.map((line, lineIdx) => (
                            <Box key={lineIdx} width="100%" flexDirection="row" alignItems="center" flexWrap="nowrap">
                              <Box flexDirection="row" alignItems="center" flexShrink={1} flexWrap="nowrap">
                                {line.map((svc, sIdx) => (
                                  <Box key={sIdx} marginRight={1} flexShrink={0}>
                                    <Text color={theme.colors.textPrimary}>{svc.name}</Text>
                                    {svc.port ? <Text color={theme.colors.accent}>:{svc.port}</Text> : null}
                                    {sIdx < line.length - 1 ? (
                                      <Text color={theme.colors.textDim}> ·</Text>
                                    ) : null}
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          ))}
                          {hiddenServiceCount > 0 && (
                            <Text color={theme.colors.textDim}>+{hiddenServiceCount} more</Text>
                          )}
                        </Box>
                      )}

                      {isSelected && cfg.isValid && cfg.services.length === 0 && (
                        <Box width="100%" marginTop={1} paddingLeft={3}>
                          <Text color={theme.colors.textDim}>No services configured</Text>
                        </Box>
                      )}

                      {cfg.error && (
                        <Box width="100%" marginTop={1} paddingLeft={3}>
                          <Text color={theme.colors.stopped} wrap="truncate-end">{cfg.error}</Text>
                        </Box>
                      )}
                    </Box>
                  </Clickable>
                );
                  })}
                </Box>
              ))}

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
            <Box marginRight={2}><Text color={theme.colors.accent} bold>[←↑↓→/Click]</Text><Text color={theme.colors.textMuted}> Select</Text></Box>
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
