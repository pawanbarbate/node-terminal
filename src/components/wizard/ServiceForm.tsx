import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ServiceConfig } from '../../types/config.js';
import { validateDirectory } from '../../services/configManager.js';

export interface ServiceFormProps {
  initialValues?: Partial<ServiceConfig>;
  isEditing?: boolean;
  serviceIndex?: number;
  suggestions?: Partial<ServiceConfig>[];
  onSubmit: (service: ServiceConfig) => void;
  onCancel: () => void;
  width?: number;
}

type FieldName = 'name' | 'path' | 'command' | 'port' | 'autoStart' | 'dependsOn' | 'preStart' | 'submit';

const FIELDS: FieldName[] = ['name', 'path', 'command', 'port', 'autoStart', 'dependsOn', 'preStart', 'submit'];

export const ServiceForm: React.FC<ServiceFormProps> = ({
  initialValues,
  isEditing = false,
  serviceIndex = 0,
  suggestions = [],
  onSubmit,
  onCancel,
  width = 80
}) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [pathValue, setPathValue] = useState(initialValues?.path || '');
  const [command, setCommand] = useState<string>(
    Array.isArray(initialValues?.command) ? initialValues.command.join(' && ') : (initialValues?.command || 'npm run dev')
  );
  const [port, setPort] = useState(initialValues?.port ? String(initialValues.port) : '');
  const [autoStart, setAutoStart] = useState<boolean>(initialValues?.autoStart ?? true);
  const [dependsOn, setDependsOn] = useState(Array.isArray(initialValues?.dependsOn) ? initialValues.dependsOn.join(', ') : '');
  const [preStart, setPreStart] = useState(Array.isArray(initialValues?.preStart) ? initialValues.preStart.join(' && ') : '');
  const [focusedField, setFocusedField] = useState<FieldName>('name');
  const [error, setError] = useState<string | null>(null);

  const isDirValid = pathValue.trim() ? validateDirectory(pathValue.trim()) : false;

  const handleApplySuggestion = (sug: Partial<ServiceConfig>) => {
    if (sug.name) setName(sug.name);
    if (sug.path) setPathValue(sug.path);
    if (sug.command) setCommand(Array.isArray(sug.command) ? sug.command.join(' && ') : sug.command);
    if (sug.port) setPort(String(sug.port));
    if (sug.autoStart !== undefined) setAutoStart(sug.autoStart);
    if (sug.dependsOn) setDependsOn(Array.isArray(sug.dependsOn) ? sug.dependsOn.join(', ') : '');
    if (sug.preStart) setPreStart(Array.isArray(sug.preStart) ? sug.preStart.join(' && ') : '');
  };

  const handleFormSubmit = () => {
    if (!name.trim()) {
      setError('Service name is required');
      setFocusedField('name');
      return;
    }
    if (!pathValue.trim()) {
      setError('Folder path is required');
      setFocusedField('path');
      return;
    }
    if (!command.trim()) {
      setError('Start command is required');
      setFocusedField('command');
      return;
    }

    const parsedPort = port.trim() ? parseInt(port.trim(), 10) : undefined;
    if (port.trim() && (isNaN(parsedPort!) || parsedPort! <= 0 || parsedPort! > 65535)) {
      setError('Port must be a valid number between 1 and 65535');
      setFocusedField('port');
      return;
    }

    const parsedDeps = dependsOn.trim()
      ? dependsOn.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : undefined;

    const parsedPre = preStart.trim()
      ? (preStart.includes('&&')
          ? preStart.split('&&').map(s => s.trim()).filter(Boolean)
          : [preStart.trim()])
      : undefined;

    setError(null);
    onSubmit({
      name: name.trim(),
      path: pathValue.trim(),
      command: command.trim(),
      port: parsedPort,
      autoStart,
      dependsOn: parsedDeps,
      preStart: parsedPre
    });
  };

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Tab or Down arrow moves to next field
    if (key.tab || key.downArrow) {
      const idx = FIELDS.indexOf(focusedField);
      const nextIdx = (idx + 1) % FIELDS.length;
      setFocusedField(FIELDS[nextIdx]!);
      setError(null);
      return;
    }

    // Shift+Tab or Up arrow moves to previous field
    if ((key.tab && key.shift) || key.upArrow) {
      const idx = FIELDS.indexOf(focusedField);
      const prevIdx = (idx - 1 + FIELDS.length) % FIELDS.length;
      setFocusedField(FIELDS[prevIdx]!);
      setError(null);
      return;
    }

    // Enter submission
    if (key.return) {
      if (focusedField === 'submit') {
        handleFormSubmit();
      } else if (focusedField === 'autoStart') {
        setAutoStart(prev => !prev);
      } else {
        // Move to next field or submit if on last input
        const idx = FIELDS.indexOf(focusedField);
        if (idx === FIELDS.length - 2) {
          handleFormSubmit();
        } else {
          setFocusedField(FIELDS[idx + 1]!);
        }
      }
      return;
    }

    // Toggle autoStart with Space
    if (focusedField === 'autoStart' && (input === ' ' || input === 'x')) {
      setAutoStart(prev => !prev);
      return;
    }

    // Typing in text fields
    if (focusedField === 'name') {
      if (key.backspace || key.delete) setName(prev => prev.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setName(prev => prev + input);
    } else if (focusedField === 'path') {
      if (key.backspace || key.delete) setPathValue(prev => prev.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setPathValue(prev => prev + input);
    } else if (focusedField === 'command') {
      if (key.backspace || key.delete) setCommand(prev => prev.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setCommand(prev => prev + input);
    } else if (focusedField === 'port') {
      if (key.backspace || key.delete) setPort(prev => prev.slice(0, -1));
      else if (/^\d$/.test(input)) setPort(prev => prev + input);
    } else if (focusedField === 'dependsOn') {
      if (key.backspace || key.delete) setDependsOn(prev => prev.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setDependsOn(prev => prev + input);
    } else if (focusedField === 'preStart') {
      if (key.backspace || key.delete) setPreStart(prev => prev.slice(0, -1));
      else if (input && !key.ctrl && !key.meta) setPreStart(prev => prev + input);
    }
  });

  const cardWidth = Math.min(width - 2, 74);

  return (
    <Box 
      borderStyle="round" 
      borderColor="#38bdf8" 
      flexDirection="column" 
      paddingX={1} 
      paddingY={0}
      width={cardWidth}
    >
      {/* Title */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <Text color="#38bdf8" bold>
          {isEditing ? `✏ Edit Service #${serviceIndex + 1}` : `+ Register Service #${serviceIndex + 1}`}
        </Text>
        <Text color="#64748b">[ESC: Cancel / Back]</Text>
      </Box>

      {/* Auto-detect suggestions bar if any */}
      {suggestions.length > 0 && !isEditing && (
        <Box flexDirection="column" marginY={0} paddingX={1} backgroundColor="#0f172a">
          <Text color="#94a3b8" bold>💡 Auto-detected in workspace (click or press 1-{suggestions.length} to autofill):</Text>
          <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
            {suggestions.slice(0, 4).map((sug, i) => (
              <Box 
                key={i} 
                marginRight={1} 
                backgroundColor="#1e293b" 
                paddingX={1}
              >
                <Text color="#38bdf8">
                  {i + 1}. {sug.name} ({sug.path})
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Error alert banner */}
      {error && (
        <Box paddingX={1} marginY={0} backgroundColor="#7f1d1d">
          <Text color="#f87171" bold>✖ {error}</Text>
        </Box>
      )}

      {/* Form Fields */}
      <Box flexDirection="column" marginTop={0}>
        {/* 1. Service Name */}
        <Box flexDirection="row" alignItems="center" marginY={0}>
          <Box width={18}>
            <Text color={focusedField === 'name' ? '#38bdf8' : '#94a3b8'} bold={focusedField === 'name'}>
              {focusedField === 'name' ? '▶ ' : '  '}Service Name:
            </Text>
          </Box>
          <Box 
            backgroundColor={focusedField === 'name' ? '#1e293b' : '#0f172a'} 
            paddingX={1}
            width={34}
          >
            <Text color="white">{name || (focusedField === 'name' ? '' : 'e.g. auth-service')}</Text>
            {focusedField === 'name' && <Text color="#38bdf8">▎</Text>}
          </Box>
        </Box>

        {/* 2. Folder Path */}
        <Box flexDirection="row" alignItems="center" marginY={0}>
          <Box width={18}>
            <Text color={focusedField === 'path' ? '#38bdf8' : '#94a3b8'} bold={focusedField === 'path'}>
              {focusedField === 'path' ? '▶ ' : '  '}Folder Path:
            </Text>
          </Box>
          <Box 
            backgroundColor={focusedField === 'path' ? '#1e293b' : '#0f172a'} 
            paddingX={1}
            width={34}
          >
            <Text color="white">{pathValue || (focusedField === 'path' ? '' : 'e.g. ./services/auth')}</Text>
            {focusedField === 'path' && <Text color="#38bdf8">▎</Text>}
          </Box>
          <Box marginLeft={1}>
            {pathValue.trim() ? (
              isDirValid ? (
                <Text color="#22c55e">✔ Found</Text>
              ) : (
                <Text color="#f59e0b">⚠ Not found</Text>
              )
            ) : null}
          </Box>
        </Box>

        {/* 3. Run Command */}
        <Box flexDirection="row" alignItems="center" marginY={0}>
          <Box width={18}>
            <Text color={focusedField === 'command' ? '#38bdf8' : '#94a3b8'} bold={focusedField === 'command'}>
              {focusedField === 'command' ? '▶ ' : '  '}Start Command:
            </Text>
          </Box>
          <Box 
            backgroundColor={focusedField === 'command' ? '#1e293b' : '#0f172a'} 
            paddingX={1}
            width={34}
          >
            <Text color="white">{command || (focusedField === 'command' ? '' : 'e.g. npm run dev')}</Text>
            {focusedField === 'command' && <Text color="#38bdf8">▎</Text>}
          </Box>
        </Box>

        {/* 4. Port */}
        <Box flexDirection="row" alignItems="center" marginY={0}>
          <Box width={18}>
            <Text color={focusedField === 'port' ? '#38bdf8' : '#94a3b8'} bold={focusedField === 'port'}>
              {focusedField === 'port' ? '▶ ' : '  '}Port (optional):
            </Text>
          </Box>
          <Box 
            backgroundColor={focusedField === 'port' ? '#1e293b' : '#0f172a'} 
            paddingX={1}
            width={16}
          >
            <Text color="white">{port || (focusedField === 'port' ? '' : 'e.g. 3001')}</Text>
            {focusedField === 'port' && <Text color="#38bdf8">▎</Text>}
          </Box>
        </Box>

        {/* 5. Auto Start */}
        <Box flexDirection="row" alignItems="center" marginY={0}>
          <Box width={18}>
            <Text color={focusedField === 'autoStart' ? '#38bdf8' : '#94a3b8'} bold={focusedField === 'autoStart'}>
              {focusedField === 'autoStart' ? '▶ ' : '  '}Auto-Start:
            </Text>
          </Box>
          <Box flexDirection="row" alignItems="center">
            <Text color={autoStart ? '#22c55e' : '#64748b'} bold>
              [{autoStart ? '✔ Yes' : '  No '}]
            </Text>
            <Text color="#64748b"> (Start automatically on boot)</Text>
          </Box>
        </Box>
      </Box>

      {/* Action Buttons */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
        <Text color="#64748b">
          [Tab / ↑↓] Switch field  •  [Enter] {focusedField === 'submit' ? 'Confirm' : 'Next / Save'}
        </Text>
        <Box flexDirection="row">
          <Box 
            backgroundColor={focusedField === 'submit' ? '#2563eb' : '#1e293b'} 
            paddingX={2}
          >
            <Text color={focusedField === 'submit' ? 'white' : '#94a3b8'} bold>
              {isEditing ? '✔ Save Service' : '+ Add Service'}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ServiceForm;

