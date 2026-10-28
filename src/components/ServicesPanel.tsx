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
      case 'blocked':
        return theme.colors.stopped;
      case 'warning':
      case 'starting':
      case 'waiting':
        return theme.colors.warning;
      default:
        return theme.colors.textMuted;
    }
  };

  const innerWidth = Math.max(16, panelWidth - 4);

  // Windowing calculation: ensure selectedIndex is always within the visible view
  // Option 2 (Enclosed Boxed Cards): 4 rows for 2-line cards, 3 rows for compact 1-line cards
  const cardHeight = isCompactHeight ? 3 : 4;
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

      {/* Services List - Discrete Enclosed Cards (Boxed Tiles) */}
      <Box flexDirection="column" marginTop={0}>
        {visibleServices.map((service, vIndex) => {
          const index = startIndex + vIndex;
          const isSelected = index === selectedIndex;
          const dotColor = getStatusColor(service.status);
          const portText = cleanPort(service.port);

          // Compact 1-line mode for standard (<= 25 rows) terminals
          if (isCompactHeight) {
            return (
              <Clickable 
                key={service.id}
                onClick={() => {
                  onFocus?.();
                  onSelectService?.(index);
                }}
                borderStyle="round"
                borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderDefault}
                backgroundColor={isSelected ? theme.colors.card : undefined}
                flexDirection="row" 
                justifyContent="space-between"
                alignItems="center"
                paddingX={1}
                width="100%"
                marginBottom={0}
              >
                <Box flexDirection="row" alignItems="center" flexShrink={1}>
                  <Text color={isSelected ? theme.colors.accent : dotColor} bold={isSelected}>
                    {isSelected ? '▎ ' : '● '}
                  </Text>
                  <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary} bold={isSelected} wrap="truncate-end">
                    {service.name}
                  </Text>
                </Box>
                <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
                  {portText ? (
                    <Text backgroundColor={isSelected ? theme.colors.accentDark : undefined} color={isSelected ? theme.colors.accent : theme.colors.textMuted}>
                      {`[${portText}] `}
                    </Text>
                  ) : null}
                  <Text color={isSelected ? (service.status === 'running' ? theme.colors.running : dotColor) : theme.colors.textMuted}>
                    {service.status === 'running' ? service.uptime : (service.statusText || service.status.toUpperCase())}
                  </Text>
                </Box>
              </Clickable>
            );
          }

          // Full 2-line cards for taller terminals (termHeight >= 26) - Discrete Enclosed Cards
          return (
            <Clickable 
              key={service.id}
              onClick={() => {
                onFocus?.();
                onSelectService?.(index);
              }}
              borderStyle="round"
              borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderDefault}
              backgroundColor={isSelected ? theme.colors.card : undefined}
              flexDirection="column"
              paddingX={1}
              width="100%"
              marginBottom={0}
            >
              {/* Row 1: Status Indicator, Service Name & Uptime / Status */}
              <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
                <Box flexDirection="row" alignItems="center" flexShrink={1}>
                  <Text color={isSelected ? theme.colors.accent : dotColor} bold={isSelected}>
                    {isSelected ? '▎ ' : '● '}
                  </Text>
                  <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary} bold={isSelected} wrap="truncate-end">
                    {service.name}
                  </Text>
                </Box>
                <Box flexShrink={0} marginLeft={1}>
                  {service.status === 'running' ? (
                    <Text color={isSelected ? theme.colors.running : theme.colors.textMuted}>
                      {service.uptime}
                    </Text>
                  ) : (
                    <Text color={dotColor} bold={isSelected}>
                      {service.statusText || String(service.status).toUpperCase()}
                    </Text>
                  )}
                </Box>
              </Box>

              {/* Row 2: Truncated Command & Port Badge */}
              <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
                <Box flexShrink={1} flexGrow={0}>
                  <Text color={isSelected ? theme.colors.textSecondary : theme.colors.textMuted} wrap="truncate-end">
                    {'↓ '}{Array.isArray(service.command) ? (service.command as string[]).join(' && ') : service.command}
                  </Text>
                </Box>
                {portText ? (
                  <Box flexShrink={0} marginLeft={1}>
                    <Text backgroundColor={isSelected ? theme.colors.accentDark : undefined} color={isSelected ? theme.colors.accent : theme.colors.textMuted}>
                      {`[${portText}]`}
                    </Text>
                  </Box>
                ) : null}
              </Box>
            </Clickable>
          );
        })}
      </Box>
    </Box>
  );
});

export default ServicesPanel;
