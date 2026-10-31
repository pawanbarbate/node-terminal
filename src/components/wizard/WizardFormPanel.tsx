import React from 'react';
import { Box, Text } from 'ink';
import { ServiceConfig } from '../../types/config.js';
import { validateDirectory } from '../../services/configManager.js';
import Clickable from '../common/ClickManager.js';
import { theme, getServiceBadgeStyle } from '../../theme/theme.js';

export type WizardFormField = 
  | 'name' 
  | 'path' 
  | 'command' 
  | 'port' 
  | 'autoStart' 
  | 'dependsOn' 
  | 'preStart' 
  | 'saveBtn';

export interface WizardFormPanelProps {
  isEditingNew: boolean;
  editingIndex: number;
  totalServices: number;
  name: string;
  pathValue: string;
  command: string;
  port: string;
  autoStart: boolean;
  dependsOnStr?: string;
  preStartStr?: string;
  availableServices?: string[];
  focusedField: WizardFormField;
  isFocused: boolean;
  error: string | null;
  suggestions: Partial<ServiceConfig>[];
  panelWidth: number;
  contentHeight: number;
  isUltraNarrow?: boolean;
  onFocusField?: (field: WizardFormField) => void;
  onToggleAutoStart?: () => void;
  onAddDependency?: (depName: string) => void;
  onApplySuggestion?: (sug: Partial<ServiceConfig>) => void;
  onSubmit?: () => void;
  onClear?: () => void;
}

export const WizardFormPanel: React.FC<WizardFormPanelProps> = React.memo(({
  isEditingNew,
  editingIndex,
  totalServices,
  name,
  pathValue,
  command,
  port,
  autoStart,
  dependsOnStr = '',
  preStartStr = '',
  availableServices = [],
  focusedField,
  isFocused,
  error,
  suggestions,
  panelWidth,
  contentHeight,
  isUltraNarrow = false,
  onFocusField,
  onToggleAutoStart,
  onAddDependency,
  onApplySuggestion,
  onSubmit,
  onClear
}) => {
  const isDirValid = pathValue.trim() ? validateDirectory(pathValue.trim()) : false;
  const innerWidth = Math.max(20, panelWidth - 4);
  const labelWidth = 11;
  const isCompact = isUltraNarrow || panelWidth < 58;
  const isTight = contentHeight < 24;

  const displayTitle = name.trim() || (isEditingNew ? 'New Service' : 'Service');
  const badge = getServiceBadgeStyle(displayTitle);

  // Live Bash execution preview string
  const resolvedDir = pathValue.trim() || './';
  const resolvedPre = preStartStr.trim() ? `${preStartStr.trim()} && ` : '';
  const resolvedCmd = command.trim() || 'npm run dev';
  const envPortPrefix = port.trim() ? `PORT=${port.trim()} ` : '';
  const bashCommandPreview = `$ cd ${resolvedDir} && ${resolvedPre}${envPortPrefix}${resolvedCmd}`;
  const truncatedBash = bashCommandPreview.length > innerWidth - 2
    ? `${bashCommandPreview.slice(0, innerWidth - 3)}…`
    : bashCommandPreview;

  const parsedDeps = dependsOnStr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const sectionHeading = (number: string, title: string) => (
    <Box flexDirection="row" alignItems="center" marginTop={isTight ? 0 : 1} marginBottom={0}>
      <Text color={theme.colors.accent} bold>{number} </Text>
      <Text color={theme.colors.textSecondary} bold>{title}</Text>
      {!isCompact && <Text color={theme.colors.borderSubtle}> {'─'.repeat(Math.max(3, innerWidth - 19))}</Text>}
    </Box>
  );

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
      {/* Upper Area: Header, Suggestions, Error & Form Fields */}
      <Box flexDirection="column" width="100%">
        {/* Panel Header */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={0} flexWrap="nowrap">
          <Box flexDirection="row" alignItems="center" flexShrink={1}>
            <Text color={isFocused ? theme.colors.accent : theme.colors.textPrimary} bold>
              {isEditingNew ? '✦ NEW SERVICE' : `EDIT: ${displayTitle}`}
            </Text>
          </Box>
          <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
            <Text backgroundColor={theme.colors.card} color={theme.colors.accent} bold>
              {isEditingNew 
                ? ' [New Service] ' 
                : totalServices > 0 
                  ? ` [Service ${editingIndex + 1} of ${totalServices}] ` 
                  : ' [New Service] '}
            </Text>
          </Box>
        </Box>

        {/* Quick Suggestion Chips */}
        {suggestions.length > 0 ? (
          <Box flexDirection="row" flexWrap="nowrap" alignItems="center" marginTop={1}>
            <Text color={theme.colors.textMuted}>DETECTED </Text>
            {suggestions.slice(0, 1).map((sug, i) => (
              <Clickable
                key={i}
                id={`chip-suggestion-${i}`}
                onClick={() => onApplySuggestion?.(sug)}
                marginRight={1}
              >
                <Box backgroundColor={theme.colors.card} paddingX={1}>
                  <Text color={theme.colors.accent}>⚡ {sug.name}</Text>
                </Box>
              </Clickable>
            ))}
          </Box>
        ) : (
          <Box marginTop={isTight ? 0 : 1}>
            <Text color={theme.colors.textMuted}>Configure this service for your workspace.</Text>
          </Box>
        )}

        {/* Error Alert Banner */}
        {error ? (
          <Box backgroundColor={theme.colors.stoppedBg} paddingX={1} marginTop={1}>
            <Text color={theme.colors.stopped} bold wrap="truncate-end">✖ {error}</Text>
          </Box>
        ) : null}

        {/* Form Input Cards Container */}
        <Box flexDirection="column" width="100%" marginTop={0}>
          {sectionHeading('01', 'IDENTITY')}

          {/* Field 1: Service Name & Deterministic Badge */}
          <Clickable id="input-field-name" onClick={() => onFocusField?.('name')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'name' ? theme.colors.cardHover : theme.colors.card}
              borderStyle={focusedField === 'name' ? 'round' : undefined}
              borderColor={focusedField === 'name' ? theme.colors.borderFocus : theme.colors.borderSubtle}
              paddingX={1}
              marginBottom={0}
              flexWrap="nowrap"
            >
              <Box flexDirection="row" alignItems="center" flexShrink={0} width={labelWidth}>
                <Text color={focusedField === 'name' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'name'}>
                  {focusedField === 'name' ? '▎ ' : '  '}Name:
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text color={theme.colors.textPrimary} bold={focusedField === 'name'} wrap="truncate-end">
                  {name || (focusedField === 'name' ? '' : 'e.g. auth-service')}
                </Text>
                {focusedField === 'name' && <Text color={theme.colors.accent}>▎</Text>}
              </Box>
              <Box flexShrink={0} marginLeft={1}>
                <Text backgroundColor={badge.bg} color={badge.fg} bold>
                  {badge.label}
                </Text>
              </Box>
            </Box>
          </Clickable>

          {/* Field 2: Folder Path */}
          <Clickable id="input-field-path" onClick={() => onFocusField?.('path')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'path' ? theme.colors.cardHover : theme.colors.card}
              borderStyle={focusedField === 'path' ? 'round' : undefined}
              borderColor={focusedField === 'path' ? theme.colors.borderFocus : theme.colors.borderSubtle}
              paddingX={1}
              marginBottom={0}
              flexWrap="nowrap"
            >
              <Box flexDirection="row" alignItems="center" flexShrink={0} width={labelWidth}>
                <Text color={focusedField === 'path' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'path'}>
                  {focusedField === 'path' ? '▎ ' : '  '}Folder:
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text color={theme.colors.textPrimary} bold={focusedField === 'path'} wrap="truncate-end">
                  {pathValue || (focusedField === 'path' ? '' : 'e.g. ./services/auth')}
                </Text>
                {focusedField === 'path' && <Text color={theme.colors.accent}>▎</Text>}
              </Box>
              <Box flexShrink={0} marginLeft={1}>
                {pathValue.trim() ? (
                  isDirValid ? (
                    <Text color={theme.colors.running} bold>✔ Found</Text>
                  ) : (
                    <Text color={theme.colors.warning} bold>⚠ Missing</Text>
                  )
                ) : (
                  <Text color={theme.colors.textMuted}>./path</Text>
                )}
              </Box>
            </Box>
          </Clickable>

          {sectionHeading('02', 'STARTUP')}

          {/* Field 3: Start Command */}
          <Clickable id="input-field-command" onClick={() => onFocusField?.('command')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'command' ? theme.colors.cardHover : theme.colors.card}
              borderStyle={focusedField === 'command' ? 'round' : undefined}
              borderColor={focusedField === 'command' ? theme.colors.borderFocus : theme.colors.borderSubtle}
              paddingX={1}
              marginBottom={0}
              flexWrap="nowrap"
            >
              <Box flexDirection="row" alignItems="center" flexShrink={0} width={labelWidth}>
                <Text color={focusedField === 'command' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'command'}>
                  {focusedField === 'command' ? '▎ ' : '  '}Command:
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text color={theme.colors.textPrimary} bold={focusedField === 'command'} wrap="truncate-end">
                  {command || (focusedField === 'command' ? '' : 'e.g. npm run dev')}
                </Text>
                {focusedField === 'command' && <Text color={theme.colors.accent}>▎</Text>}
              </Box>
              <Box flexShrink={0} marginLeft={1}>
                <Text color={theme.colors.textMuted}>exec</Text>
              </Box>
            </Box>
          </Clickable>

          {/* Field 4: Port & Auto-Start */}
          {isCompact ? (
            <Box flexDirection="column">
              <Clickable id="input-field-port" onClick={() => onFocusField?.('port')}>
                <Box
                  flexDirection="row"
                  alignItems="center"
                  backgroundColor={focusedField === 'port' ? theme.colors.cardHover : theme.colors.card}
                  borderStyle={focusedField === 'port' ? 'round' : undefined}
                  borderColor={focusedField === 'port' ? theme.colors.borderFocus : theme.colors.borderSubtle}
                  paddingX={1}
                >
                  <Box width={labelWidth}>
                    <Text color={focusedField === 'port' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'port'}>
                      {focusedField === 'port' ? '▎ ' : '  '}Port:
                    </Text>
                  </Box>
                  <Text color={theme.colors.accent} bold>
                    {port ? `:${port}` : (focusedField === 'port' ? '' : 'e.g. 3001')}
                  </Text>
                  {focusedField === 'port' && <Text color={theme.colors.accent}>▎</Text>}
                </Box>
              </Clickable>
              <Clickable id="input-field-autostart" onClick={() => onToggleAutoStart?.()}>
                <Box
                  flexDirection="row"
                  alignItems="center"
                  backgroundColor={focusedField === 'autoStart' ? theme.colors.cardHover : theme.colors.card}
                  borderStyle={focusedField === 'autoStart' ? 'round' : undefined}
                  borderColor={focusedField === 'autoStart' ? theme.colors.borderFocus : theme.colors.borderSubtle}
                  paddingX={1}
                >
                  <Box width={labelWidth}>
                    <Text color={focusedField === 'autoStart' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'autoStart'}>
                      {focusedField === 'autoStart' ? '▎ ' : '  '}Boot:
                    </Text>
                  </Box>
                  <Text color={autoStart ? theme.colors.running : theme.colors.textMuted} bold>
                    {autoStart ? '[◉ Auto]' : '[○ Manual]'}
                  </Text>
                </Box>
              </Clickable>
            </Box>
          ) : (
            <Box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="nowrap"
            >
              <Clickable id="input-field-port" onClick={() => onFocusField?.('port')}>
                <Box
                  flexDirection="row"
                  alignItems="center"
                  flexShrink={0}
                  backgroundColor={focusedField === 'port' ? theme.colors.cardHover : theme.colors.card}
                  borderStyle={focusedField === 'port' ? 'round' : undefined}
                  borderColor={focusedField === 'port' ? theme.colors.borderFocus : theme.colors.borderSubtle}
                  paddingX={1}
                >
                  <Box width={labelWidth}>
                    <Text color={focusedField === 'port' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'port'}>
                      {focusedField === 'port' ? '▎ ' : '  '}Port:
                    </Text>
                  </Box>
                  <Text color={theme.colors.accent} bold>
                    {port ? `:${port}` : (focusedField === 'port' ? '' : 'e.g. 3001')}
                  </Text>
                  {focusedField === 'port' && <Text color={theme.colors.accent}>▎</Text>}
                </Box>
              </Clickable>
              <Clickable id="input-field-autostart" onClick={() => onToggleAutoStart?.()}>
                <Box
                  flexDirection="row"
                  alignItems="center"
                  flexShrink={0}
                  marginLeft={1}
                  backgroundColor={focusedField === 'autoStart' ? theme.colors.cardHover : theme.colors.card}
                  borderStyle={focusedField === 'autoStart' ? 'round' : undefined}
                  borderColor={focusedField === 'autoStart' ? theme.colors.borderFocus : theme.colors.borderSubtle}
                  paddingX={1}
                >
                  <Text color={focusedField === 'autoStart' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'autoStart'}>
                    {focusedField === 'autoStart' ? '▶ ' : '  '}Boot:{' '}
                  </Text>
                  <Text color={autoStart ? theme.colors.running : theme.colors.textMuted} bold>
                    {autoStart ? '[◉ Auto]' : '[○ Manual]'}
                  </Text>
                </Box>
              </Clickable>
            </Box>
          )}

          {sectionHeading('03', 'ORCHESTRATION')}

          {/* Field 5: Service Dependencies (dependsOn) */}
          <Clickable id="input-field-dependson" onClick={() => onFocusField?.('dependsOn')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'dependsOn' ? theme.colors.cardHover : theme.colors.card}
              borderStyle={focusedField === 'dependsOn' ? 'round' : undefined}
              borderColor={focusedField === 'dependsOn' ? theme.colors.borderFocus : theme.colors.borderSubtle}
              paddingX={1}
              marginBottom={0}
              flexWrap="nowrap"
            >
              <Box flexDirection="row" alignItems="center" flexShrink={0} width={labelWidth}>
                <Text color={focusedField === 'dependsOn' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'dependsOn'}>
                  {focusedField === 'dependsOn' ? '▎ ' : '  '}Depends:
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text color={theme.colors.textPrimary} bold={focusedField === 'dependsOn'} wrap="truncate-end">
                  {dependsOnStr || (focusedField === 'dependsOn' ? '' : 'e.g. orders, products')}
                </Text>
                {focusedField === 'dependsOn' && <Text color={theme.colors.accent}>▎</Text>}
              </Box>
              <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
                {availableServices && availableServices.length > 0 ? (
                  availableServices.slice(0, 2).map((dep, dIdx) => (
                    <Clickable key={dIdx} id={`chip-dep-${dep}`} onClick={() => onAddDependency?.(dep)}>
                      <Box backgroundColor={theme.colors.surface} paddingX={1} marginLeft={1}>
                        <Text color={theme.colors.accent}>+{dep}</Text>
                      </Box>
                    </Clickable>
                  ))
                ) : (
                  <Text color={theme.colors.textDim}>DAG</Text>
                )}
              </Box>
            </Box>
          </Clickable>

          {/* Field 6: Pre-Start Setup Pipeline (preStart) */}
          <Clickable id="input-field-prestart" onClick={() => onFocusField?.('preStart')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'preStart' ? theme.colors.cardHover : theme.colors.card}
              borderStyle={focusedField === 'preStart' ? 'round' : undefined}
              borderColor={focusedField === 'preStart' ? theme.colors.borderFocus : theme.colors.borderSubtle}
              paddingX={1}
              marginBottom={0}
              flexWrap="nowrap"
            >
              <Box flexDirection="row" alignItems="center" flexShrink={0} width={labelWidth}>
                <Text color={focusedField === 'preStart' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'preStart'}>
                  {focusedField === 'preStart' ? '▎ ' : '  '}Pre-cmd:
                </Text>
              </Box>
              <Box flexGrow={1} flexShrink={1}>
                <Text color={theme.colors.textPrimary} bold={focusedField === 'preStart'} wrap="truncate-end">
                  {preStartStr || (focusedField === 'preStart' ? '' : 'e.g. npm run migrate')}
                </Text>
                {focusedField === 'preStart' && <Text color={theme.colors.accent}>▎</Text>}
              </Box>
              <Box flexShrink={0} marginLeft={1}>
                <Text color={theme.colors.textDim}>step 1</Text>
              </Box>
            </Box>
          </Clickable>
        </Box>

        {/* Live Process Blueprint Preview (when terminal height is comfortable >= 26) */}
        {contentHeight >= 26 && (
          <Box 
            flexDirection="column"
            borderStyle="round"
            borderColor={theme.colors.borderSubtle}
            backgroundColor={theme.colors.card}
            paddingX={1}
            marginTop={1}
            marginBottom={0}
          >
            <Box flexDirection="row" justifyContent="space-between" alignItems="center">
              <Text color={theme.colors.accent} bold>⚡ PROCESS BLUEPRINT:</Text>
              <Text color={autoStart ? theme.colors.running : theme.colors.warning}>
                {autoStart ? '● Auto-boot' : '○ Manual trigger'}
              </Text>
            </Box>
            <Text color={theme.colors.running} bold>{truncatedBash}</Text>
            {parsedDeps.length > 0 ? (
              <Text color={theme.colors.warning}>
                ⏳ WAITS FOR: [{parsedDeps.join(', ')}] on listening TCP ports
              </Text>
            ) : (
              <Text color={theme.colors.textDim}>
                ✔ Independent service (starts immediately in Tier 0)
              </Text>
            )}
          </Box>
        )}
      </Box>

      {/* Lower Area: Action Buttons Row */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" marginTop={isTight ? 0 : 1}>
        <Box flexDirection="row" alignItems="center">
          <Clickable id="btn-submit-form" onClick={() => onSubmit?.()} marginRight={1}>
            <Box 
              backgroundColor={focusedField === 'saveBtn' ? theme.colors.accentDark : theme.colors.card} 
              paddingX={2}
            >
              <Text color={focusedField === 'saveBtn' ? theme.colors.accent : theme.colors.textPrimary} bold>
                {isCompact
                  ? (isEditingNew ? '+ Add' : '✔ Save')
                  : (isEditingNew ? '+ Add to Registry' : '✔ Save Changes')}
              </Text>
            </Box>
          </Clickable>

          <Clickable id="btn-clear-form" onClick={() => onClear?.()}>
            <Box backgroundColor={theme.colors.card} paddingX={1}>
              <Text color={theme.colors.textSecondary}>↺ Clear</Text>
            </Box>
          </Clickable>
        </Box>

        <Text color={theme.colors.textMuted}>{isCompact ? '[Tab / ↑↓]' : '[Tab / ↑↓ fields]'}</Text>
      </Box>
    </Box>
  );
});

export default WizardFormPanel;
