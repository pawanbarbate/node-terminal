import React from 'react';
import { Box, Text } from 'ink';
import { ServiceConfig } from '../../types/config.js';
import { validateDirectory } from '../../services/configManager.js';
import Clickable from '../common/ClickManager.js';
import { theme, getServiceBadgeStyle } from '../../theme/theme.js';

export type WizardFormField = 'name' | 'path' | 'command' | 'port' | 'autoStart' | 'saveBtn';

export interface WizardFormPanelProps {
  isEditingNew: boolean;
  editingIndex: number;
  totalServices: number;
  name: string;
  pathValue: string;
  command: string;
  port: string;
  autoStart: boolean;
  focusedField: WizardFormField;
  isFocused: boolean;
  error: string | null;
  suggestions: Partial<ServiceConfig>[];
  panelWidth: number;
  contentHeight: number;
  isUltraNarrow?: boolean;
  onFocusField?: (field: WizardFormField) => void;
  onToggleAutoStart?: () => void;
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
  focusedField,
  isFocused,
  error,
  suggestions,
  panelWidth,
  contentHeight,
  isUltraNarrow = false,
  onFocusField,
  onToggleAutoStart,
  onApplySuggestion,
  onSubmit,
  onClear
}) => {
  const isDirValid = pathValue.trim() ? validateDirectory(pathValue.trim()) : false;
  const innerWidth = Math.max(20, panelWidth - 4);
  const labelWidth = panelWidth < 50 ? 10 : 12;

  const displayTitle = name.trim() || (isEditingNew ? 'New Service' : 'Service');
  const badge = getServiceBadgeStyle(displayTitle);

  // Live Bash execution preview string
  const resolvedDir = pathValue.trim() || './';
  const resolvedCmd = command.trim() || 'npm run dev';
  const envPortPrefix = port.trim() ? `PORT=${port.trim()} ` : '';
  const bashCommandPreview = `$ cd ${resolvedDir} && ${envPortPrefix}${resolvedCmd}`;
  const truncatedBash = bashCommandPreview.length > innerWidth - 2
    ? `${bashCommandPreview.slice(0, innerWidth - 3)}…`
    : bashCommandPreview;

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
          <Box flexDirection="row" flexWrap="nowrap" alignItems="center" marginBottom={0}>
            <Text color={theme.colors.textMuted}>Detected: </Text>
            {suggestions.slice(0, panelWidth < 60 ? 1 : 2).map((sug, i) => (
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
          <Text color={theme.colors.textMuted}>
            Configure microservice execution, folder path, and port:
          </Text>
        )}

        {/* Error Alert Banner */}
        {error ? (
          <Box backgroundColor={theme.colors.stoppedBg} paddingX={1} marginY={0}>
            <Text color={theme.colors.stopped} bold>✖ Error: {error}</Text>
          </Box>
        ) : null}

        {/* Form Input Cards Container */}
        <Box flexDirection="column" width="100%" marginTop={0}>
          {/* Field 1: Service Name & Deterministic Badge */}
          <Clickable id="input-field-name" onClick={() => onFocusField?.('name')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'name' ? theme.colors.cardHover : theme.colors.card}
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
                <Text color={theme.colors.textPrimary} bold={focusedField === 'name'}>
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
                <Text color={theme.colors.textPrimary} bold={focusedField === 'path'}>
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

          {/* Field 3: Start Command */}
          <Clickable id="input-field-command" onClick={() => onFocusField?.('command')}>
            <Box 
              flexDirection="row" 
              justifyContent="space-between" 
              alignItems="center" 
              backgroundColor={focusedField === 'command' ? theme.colors.cardHover : theme.colors.card}
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
                <Text color={theme.colors.textPrimary} bold={focusedField === 'command'}>
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
          <Box 
            flexDirection="row" 
            justifyContent="space-between" 
            alignItems="center" 
            backgroundColor={focusedField === 'port' || focusedField === 'autoStart' ? theme.colors.cardHover : theme.colors.card}
            paddingX={1}
            marginBottom={0}
            flexWrap="nowrap"
          >
            {/* Port */}
            <Clickable id="input-field-port" onClick={() => onFocusField?.('port')}>
              <Box flexDirection="row" alignItems="center" flexShrink={0}>
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

            {/* Auto-Start Switch */}
            <Clickable id="input-field-autostart" onClick={() => onToggleAutoStart?.()}>
              <Box flexDirection="row" alignItems="center" flexShrink={0} marginLeft={1}>
                <Text color={focusedField === 'autoStart' ? theme.colors.accent : theme.colors.textSecondary} bold={focusedField === 'autoStart'}>
                  {focusedField === 'autoStart' ? '▶ ' : '  '}Boot:{' '}
                </Text>
                <Text color={autoStart ? theme.colors.running : theme.colors.textMuted} bold>
                  {autoStart ? '[◉ Auto]' : '[○ Manual]'}
                </Text>
              </Box>
            </Clickable>
          </Box>
        </Box>

        {/* Live Process Blueprint Preview (Fills the previous void!) */}
        {contentHeight >= 20 && (
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
            <Text color={theme.colors.textDim}>
              Stdout/stderr aggregated into Global Logs & dedicated [{displayTitle}] tab
            </Text>
          </Box>
        )}
      </Box>

      {/* Lower Area: Action Buttons Row */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" marginTop={1}>
        <Box flexDirection="row" alignItems="center">
          <Clickable id="btn-submit-form" onClick={() => onSubmit?.()} marginRight={1}>
            <Box 
              backgroundColor={focusedField === 'saveBtn' ? theme.colors.accentDark : theme.colors.card} 
              paddingX={2}
            >
              <Text color={focusedField === 'saveBtn' ? theme.colors.accent : theme.colors.textPrimary} bold>
                {isEditingNew ? '+ Add to Registry' : '✔ Save Changes'}
              </Text>
            </Box>
          </Clickable>

          <Clickable id="btn-clear-form" onClick={() => onClear?.()}>
            <Box backgroundColor={theme.colors.card} paddingX={1}>
              <Text color={theme.colors.textSecondary}>↺ Clear</Text>
            </Box>
          </Clickable>
        </Box>

        <Text color={theme.colors.textMuted}>[Tab / ↑↓ fields]</Text>
      </Box>
    </Box>
  );
});

export default WizardFormPanel;
