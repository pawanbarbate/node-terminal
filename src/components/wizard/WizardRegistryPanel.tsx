import React from 'react';
import { Box, Text } from 'ink';
import { ServiceConfig } from '../../types/config.js';
import Clickable from '../common/ClickManager.js';
import { theme } from '../../theme/theme.js';

export interface ArchitecturePreset {
  id: string;
  label: string;
  description: string;
  services: ServiceConfig[];
}

export interface WizardRegistryPanelProps {
  services: ServiceConfig[];
  selectedIndex: number;
  isEditingNew: boolean;
  isFocused: boolean;
  panelWidth: number;
  contentHeight: number;
  isUltraNarrow?: boolean;
  presets?: ArchitecturePreset[];
  workspaceName?: string;
  configFilename?: string;
  onSelectService?: (index: number) => void;
  onAddService?: () => void;
  onRemoveService?: () => void;
  onSaveAndLaunch?: () => void;
  onApplyPreset?: (preset: ArchitecturePreset) => void;
}

const cleanPort = (p?: string | number) => {
  if (!p) return '';
  const str = String(p).trim();
  const num = str.replace(/^:+/, '');
  return `:${num}`;
};

export const WizardRegistryPanel: React.FC<WizardRegistryPanelProps> = React.memo(({
  services,
  selectedIndex,
  isEditingNew,
  isFocused,
  panelWidth,
  contentHeight,
  isUltraNarrow = false,
  presets = [],
  workspaceName = 'Workspace',
  configFilename = 'config.devpulse.json',
  onSelectService,
  onAddService,
  onRemoveService,
  onSaveAndLaunch,
  onApplyPreset
}) => {
  const innerWidth = Math.max(16, panelWidth - 4);
  // Allocate available rows for enclosed cards (4 rows per card)
  const maxVisibleServices = Math.max(1, Math.floor((contentHeight - 10) / 4));

  return (
    <Box 
      borderStyle="round" 
      borderColor={isFocused ? theme.colors.borderFocus : theme.colors.borderDefault} 
      borderBackgroundColor={theme.colors.canvas}
      backgroundColor={theme.colors.surface}
      flexDirection="column" 
      justifyContent="space-between"
      paddingX={1}
      paddingY={0}
      width={panelWidth}
      height={contentHeight}
    >
      {/* 1. Upper Area: Workspace Context & Registered Services List */}
      <Box flexDirection="column" width="100%">
        {/* Panel Header */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={0} flexWrap="nowrap">
          <Text color={isFocused ? theme.colors.accent : theme.colors.textSecondary} bold>
            {panelWidth < 35 ? `REGISTRY (${services.length})` : `SERVICE REGISTRY (${services.length})`}
          </Text>
          <Text color={theme.colors.textMuted}>{isUltraNarrow ? '[Tab: Form]' : '[↑↓ / Click]'}</Text>
        </Box>

        {/* Workspace Path Breadcrumb */}
        <Box flexDirection="row" alignItems="center" flexWrap="nowrap" marginBottom={1}>
          <Text color={theme.colors.accent}>📦 </Text>
          <Text color={theme.colors.textPrimary} bold>{workspaceName}</Text>
          <Text color={theme.colors.textDim}> │ {configFilename}</Text>
        </Box>

        {/* Empty State with Architecture Presets */}
        {services.length === 0 ? (
          <Box flexDirection="column" marginTop={0}>
            <Box backgroundColor={theme.colors.card} paddingX={1} paddingY={0} flexDirection="column" borderStyle="round" borderColor={theme.colors.borderSubtle}>
              <Text color={theme.colors.accent} bold>⚡ QUICK ARCHITECTURE PRESETS:</Text>
              <Text color={theme.colors.textMuted}>Select a pre-configured multi-service stack:</Text>

              <Box flexDirection="column" marginTop={0}>
                {presets.map((preset, idx) => (
                  <Clickable
                    key={preset.id}
                    id={`preset-${preset.id}`}
                    onClick={() => onApplyPreset?.(preset)}
                    marginRight={0}
                  >
                    <Box 
                      backgroundColor={theme.colors.surface} 
                      paddingX={1} 
                      flexDirection="column"
                      marginBottom={0}
                    >
                      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
                        <Text color={theme.colors.accent} bold>
                          {idx + 1}. {preset.label}
                        </Text>
                        <Text color={theme.colors.running}>
                          ({preset.services.length} services)
                        </Text>
                      </Box>
                      <Text color={theme.colors.textDim}>
                        {preset.description}
                      </Text>
                    </Box>
                  </Clickable>
                ))}
              </Box>
            </Box>

            <Box marginTop={1}>
              <Text color={theme.colors.textSecondary}>
                Or fill the form on the right to add a custom service.
              </Text>
            </Box>
          </Box>
        ) : (
          /* Discrete Enclosed Service Cards (Matching Main Dashboard Synergy) */
          <Box flexDirection="column" width="100%">
            {services.slice(0, maxVisibleServices).map((svc, idx) => {
              const isSelected = idx === selectedIndex && !isEditingNew;
              const portText = cleanPort(svc.port);

              return (
                <Clickable
                  key={idx}
                  id={`service-row-${idx}`}
                  onClick={() => onSelectService?.(idx)}
                  borderStyle="round"
                  borderColor={isSelected ? theme.colors.borderFocus : theme.colors.borderDefault}
                  backgroundColor={isSelected ? theme.colors.card : undefined}
                  paddingX={1}
                  flexDirection="column"
                  width="100%"
                  marginBottom={0}
                >
                  {/* Row 1: Accent Indicator, Name, Port & Auto-boot pill */}
                  <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
                    <Box flexDirection="row" alignItems="center" flexShrink={1}>
                      <Text color={isSelected ? theme.colors.accent : theme.colors.running} bold>
                        {isSelected ? '▎ ' : '● '}
                      </Text>
                      <Text color={isSelected ? theme.colors.textPrimary : theme.colors.textSecondary} bold={isSelected} wrap="truncate-end">
                        {svc.name}
                      </Text>
                    </Box>
                    <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
                      {portText ? (
                        <Text backgroundColor={isSelected ? theme.colors.accentDark : undefined} color={isSelected ? theme.colors.accent : theme.colors.textMuted} bold={isSelected}>
                          {`[${portText}] `}
                        </Text>
                      ) : null}
                      <Text color={svc.autoStart !== false ? theme.colors.running : theme.colors.textMuted}>
                        {svc.autoStart !== false ? '[AUTO]' : '[MANUAL]'}
                      </Text>
                    </Box>
                  </Box>

                  {/* Row 2: Subtitle Path, Dependencies & Execution Command */}
                  <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="nowrap">
                    <Box flexDirection="row" alignItems="center" flexShrink={1}>
                      <Text color={theme.colors.textDim} wrap="truncate-end">
                        {svc.path}
                      </Text>
                      {svc.dependsOn && svc.dependsOn.length > 0 ? (
                        <Box backgroundColor={theme.colors.card} paddingX={1} marginLeft={1} flexShrink={0}>
                          <Text color={theme.colors.accent}>
                            needs: {svc.dependsOn.join(',')}
                          </Text>
                        </Box>
                      ) : null}
                    </Box>
                    <Box flexShrink={0} marginLeft={1}>
                      <Text color={isSelected ? theme.colors.textSecondary : theme.colors.textMuted} wrap="truncate-end">
                        {'↓ '}{Array.isArray(svc.command) ? svc.command.join(' && ') : (svc.command || '')}
                      </Text>
                    </Box>
                  </Box>
                </Clickable>
              );
            })}
          </Box>
        )}
      </Box>

      {/* 2. Lower Area: Docked Action Buttons & Prominent Launch CTA */}
      <Box flexDirection="column" width="100%">
        {/* Row 1: Item Actions (+ Add, Remove) */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={0}>
          <Clickable id="btn-add-service" onClick={() => onAddService?.()}>
            <Box 
              backgroundColor={isEditingNew ? theme.colors.accentDark : theme.colors.card} 
              paddingX={1}
            >
              <Text color={isEditingNew ? theme.colors.accent : theme.colors.textPrimary} bold>
                + Add (a)
              </Text>
            </Box>
          </Clickable>

          <Clickable id="btn-remove-service" onClick={() => onRemoveService?.()}>
            <Box 
              backgroundColor={theme.colors.card} 
              paddingX={1}
            >
              <Text color={services.length > 0 ? theme.colors.stopped : theme.colors.textMuted}>
                ✖ Remove (d)
              </Text>
            </Box>
          </Clickable>
        </Box>

        {/* Divider */}
        <Box marginY={0}>
          <Text color={theme.colors.borderSubtle}>
            {'─'.repeat(Math.max(10, panelWidth - 4))}
          </Text>
        </Box>

        {/* Row 2: Prominent Save & Launch CTA Button */}
        <Clickable id="btn-save-and-launch" onClick={() => onSaveAndLaunch?.()} width="100%">
          <Box 
            backgroundColor={theme.colors.runningBg} 
            justifyContent="center" 
            alignItems="center" 
            paddingX={1}
            width="100%"
          >
            <Text color={theme.colors.running} bold>
              {panelWidth < 38 
                ? '▶ Save & Launch (s)' 
                : '▶ Save & Launch Dashboard (s)'}
            </Text>
          </Box>
        </Clickable>
      </Box>
    </Box>
  );
});

export default WizardRegistryPanel;
