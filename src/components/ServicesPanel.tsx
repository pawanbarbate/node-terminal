import React from 'react';
import { Box, Text } from 'ink';
import { Service, ServiceStatus } from '../types/index.js';
import Clickable from './common/ClickManager.js';
import { theme } from '../theme/theme.js';

export interface ServicesPanelProps {
  services?: Service[];
  selectedIndex?: number;
  isFocused?: boolean;
  isCompactHeight?: boolean;
  panelWidth?: number;
  height?: number;
  onSelectService?: (index: number) => void;
  onFocus?: () => void;
}

const cleanPort = (p?: string | number) => {
  if (!p) return '';
  const str = String(p).trim();
  const num = str.replace(/^:+/, '');
  return `:${num}`;
};

export const ServicesPanel: React.FC<ServicesPanelProps> = React.memo(({ 
  services = [], 
  selectedIndex = 0, 
  isFocused = true, 
  isCompactHeight = false,
  panelWidth = 34,
  height,
  onSelectService,
  onFocus
}) => {
  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'running':
        return theme.colors.running;
      case 'stopped':
        return theme.colors.stopped;
      case 'warning':
      case 'starting':
        return theme.colors.warning;
      default:
        return theme.colors.textMuted;
    }
  };

  const innerWidth = Math.max(16, panelWidth - 4);

  // Windowing calculation: ensure selectedIndex is always within the visible view
  const cardHeight = isCompactHeight ? 1 : 2;
  const innerHeight = Math.max(1, (height ? height - 2 : 12) - 1); // height minus borders and header
  const maxVisibleCards = Math.max(1, Math.floor(innerHeight / cardHeight));

  let startIndex = 0;
  if (services.length > maxVisibleCards) {
    if (selectedIndex >= maxVisibleCards) {
      startIndex = selectedIndex - maxVisibleCards + 1;
    }
    startIndex = Math.max(0, Math.min(services.length - maxVisibleCards, startIndex));
  }
  const visibleServices = services.slice(startIndex, startIndex + maxVisibleCards);
  const hasMoreAbove = startIndex > 0;
  const hasMoreBelow = startIndex + maxVisibleCards < services.length;

  return (
    <Box 
      borderStyle="round" 
      borderColor={isFocused ? theme.colors.borderFocus : theme.colors.borderDefault} 
      borderBackgroundColor={theme.colors.canvas}
      backgroundColor={theme.colors.surface}
      flexDirection="column" 
      justifyContent="flex-start"
      paddingX={1}
      paddingY={0}
      width={panelWidth}
      height={height}
      marginBottom={1}
    >
      {/* Header */}
      <Clickable onClick={() => onFocus?.()}>
        <Box flexDirection="row" justifyContent="space-between" marginBottom={0} flexWrap="nowrap">
          <Text color={isFocused ? theme.colors.accent : theme.colors.textSecondary} bold>
            SERVICES ({services.length})
          </Text>
          {services.length > maxVisibleCards ? (
            <Text color={theme.colors.accent}>
              {hasMoreAbove ? '▲' : ' '}{hasMoreBelow ? '▼' : ' '} [{selectedIndex + 1}/{services.length}]
            </Text>
          ) : (
            <Text color={theme.colors.textMuted}>+ ↻</Text>
          )}
        </Box>
      </Clickable>

      {/* Services List - Dynamic Windowed Scroll */}
      <Box flexDirection="column" marginTop={0}>
        {visibleServices.map((service, vIndex) => {
          const index = startIndex + vIndex;
          const isSelected = index === selectedIndex;
          const dotColor = getStatusColor(service.status);
          const portText = cleanPort(service.port);

          // Compact 1-line mode for standard (<= 25 rows) terminals
          if (isCompactHeight) {
            const maxNameLen = Math.max(7, innerWidth - 11);
            const rawName = service.name;
            const displayName = rawName.length > maxNameLen ? `${rawName.slice(0, maxNameLen - 1)}…` : rawName;

            return (
              <Clickable 
                key={service.id}
                onClick={() => {
                  onFocus?.();
                  onSelectService?.(index);
                }}
                flexDirection="row" 
                justifyContent="space-between"
                alignItems="center"
                backgroundColor={isSelected ? theme.colors.card : undefined}
                paddingX={1}
                flexWrap="nowrap"
              >
                <Box flexDirection="row" alignItems="center" flexShrink={0}>
                  <Text color={isSelected ? theme.colors.accent : dotColor} bold={isSelected}>
                    {isSelected ? '▎ ' : '● '}
                  </Text>
                  <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary} bold={isSelected}>
                    {displayName}
                  </Text>
                </Box>
                <Box flexDirection="row" alignItems="center" flexShrink={0}>
                  {portText ? (
                    <Text color={isSelected ? theme.colors.accent : theme.colors.textMuted}>
                      {portText}{' '}
                    </Text>
                  ) : null}
                  <Text color={theme.colors.textMuted}>{service.uptime}</Text>
                </Box>
              </Clickable>
            );
          }

          // Full 2-line cards for taller terminals (termHeight >= 26) - fixed 2 lines for visual stability
          if (isSelected) {
            return (
              <Clickable 
                key={service.id}
                onClick={() => {
                  onFocus?.();
                  onSelectService?.(index);
                }}
                backgroundColor={theme.colors.card}
                paddingX={1}
                flexDirection="column"
                marginBottom={0}
              >
                <Box flexDirection="row" justifyContent="space-between" flexWrap="nowrap">
                  <Box flexDirection="row" alignItems="center" flexShrink={0}>
                    <Text color={theme.colors.accent} bold>▎ </Text>
                    <Text color={theme.colors.textPrimary} bold>{service.name}</Text>
                  </Box>
                  <Text color={theme.colors.running}>{service.uptime}</Text>
                </Box>
                <Box flexDirection="row" justifyContent="space-between" flexWrap="nowrap">
                  <Text color={theme.colors.textSecondary}>  ↓ {service.command}</Text>
                  {portText ? (
                    <Text backgroundColor={theme.colors.accentDark} color={theme.colors.accent}>
                      {` ${portText} `}
                    </Text>
                  ) : null}
                </Box>
              </Clickable>
            );
          }

          return (
            <Clickable 
              key={service.id}
              onClick={() => {
                onFocus?.();
                onSelectService?.(index);
              }}
              paddingX={1}
              flexDirection="column"
              marginBottom={0}
            >
              <Box flexDirection="row" justifyContent="space-between" flexWrap="nowrap">
                <Box flexDirection="row" alignItems="center" flexShrink={0}>
                  <Text color={dotColor}>● </Text>
                  <Text color={theme.colors.textSecondary}>{service.name}</Text>
                </Box>
                <Text color={theme.colors.textMuted}>{service.uptime}</Text>
              </Box>
              <Box flexDirection="row" justifyContent="space-between" flexWrap="nowrap">
                <Text color={theme.colors.textMuted}>  ↓ {service.command}</Text>
                {portText && <Text color={theme.colors.textMuted}>{portText}</Text>}
              </Box>
            </Clickable>
          );
        })}
      </Box>
    </Box>
  );
});

export default ServicesPanel;
