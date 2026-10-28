import React, { useState, useEffect, useCallback, useRef } from 'react';
import path from 'path';
import { Box, Text, useInput } from 'ink';
import { DevPulseConfig, ServiceConfig } from '../../types/config.js';
import { autoDetectServices, saveConfigFile } from '../../services/configManager.js';
import { useTerminalViewport } from '../../hooks/useTerminalViewport.js';
import Header from '../Header.js';
import WizardRegistryPanel, { ArchitecturePreset } from './WizardRegistryPanel.js';
import WizardFormPanel, { WizardFormField } from './WizardFormPanel.js';
import WizardFooter from './WizardFooter.js';
import { ClickProvider, Clickable, ClickManagerContextValue } from '../common/ClickManager.js';
import { theme } from '../../theme/theme.js';
import { logger } from '../../logger/logger.js';

export interface SetupWizardProps {
  onComplete: (config: DevPulseConfig) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  configFilePath?: string;
}

export const ARCHITECTURE_PRESETS: ArchitecturePreset[] = [
  {
    id: 'nextjs-express',
    label: 'Next.js + Express API',
    description: 'Next.js frontend with backend Express API service',
    services: [
      { name: 'frontend', path: './apps/web', command: 'npm run dev', port: 3000, autoStart: true },
      { name: 'api', path: './services/api', command: 'npm run dev', port: 4000, autoStart: true }
    ]
  },
  {
    id: 'vite-fastapi',
    label: 'React (Vite) + FastAPI',
    description: 'Vite frontend with Python FastAPI backend and reload',
    services: [
      { name: 'web-client', path: './frontend', command: 'npm run dev', port: 5173, autoStart: true },
      { name: 'api-server', path: './backend', command: 'python -m uvicorn main:app --reload', port: 8000, autoStart: true }
    ]
  },
  {
    id: 'monorepo-stack',
    label: 'Monorepo (Web, API, Worker)',
    description: '3-tier fullstack stack with background processing worker',
    services: [
      { name: 'web', path: './apps/web', command: 'pnpm dev', port: 3000, autoStart: true },
      { name: 'api', path: './services/api', command: 'pnpm dev', port: 4000, autoStart: true },
      { name: 'worker', path: './services/worker', command: 'pnpm start', port: undefined, autoStart: true }
    ]
  }
];

const FORM_FIELDS: WizardFormField[] = ['name', 'path', 'command', 'port', 'autoStart', 'saveBtn'];

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  onCancel,
  width: propWidth,
  height: propHeight,
  configFilePath
}) => {
  const viewport = useTerminalViewport(propWidth, propHeight);
  const clickManagerRef = useRef<ClickManagerContextValue | null>(null);
  const workspaceName = path.basename(process.cwd()) || 'Workspace';
  const activeConfigFilename = configFilePath ? path.basename(configFilePath) : 'config.devpulse.json';

  // Assert clean SGR mouse reporting mode on mount
  useEffect(() => {
    try {
      process.stdout.write('\x1b[?1000h\x1b[?1006h');
    } catch {}
  }, []);

  // Live clock timer for top Header
  const [time, setTime] = useState(() => new Date().toTimeString().split(' ')[0] || '12:00:00');
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toTimeString().split(' ')[0] || '12:00:00');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Workspace auto-detected suggestions
  const [detected] = useState<Partial<ServiceConfig>[]>(() => autoDetectServices());

  // Services registry list state
  const [services, setServices] = useState<ServiceConfig[]>(() => {
    if (detected.length > 0) {
      return detected.map(d => ({
        name: d.name || 'app',
        path: d.path || '.',
        command: Array.isArray(d.command) ? d.command.join(' && ') : (d.command || 'npm run dev'),
        port: d.port,
        autoStart: d.autoStart ?? true
      }));
    }
    return [];
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditingNew, setIsEditingNew] = useState(() => detected.length === 0);
  const [activePanel, setActivePanel] = useState<'services' | 'form'>(() => detected.length === 0 ? 'form' : 'services');
  const [narrowTab, setNarrowTab] = useState<'services' | 'form'>(() => detected.length === 0 ? 'form' : 'services');

  // Active form field values
  const [name, setName] = useState(() => (detected.length > 0 ? services[0]?.name || '' : ''));
  const [pathValue, setPathValue] = useState(() => (detected.length > 0 ? services[0]?.path || '' : ''));
  const [command, setCommand] = useState<string>(() => {
    const firstCmd = detected.length > 0 ? services[0]?.command : undefined;
    return Array.isArray(firstCmd) ? firstCmd.join(' && ') : (firstCmd || 'npm run dev');
  });
  const [port, setPort] = useState(() => (detected.length > 0 && services[0]?.port ? String(services[0].port) : ''));
  const [autoStart, setAutoStart] = useState<boolean>(() => (detected.length > 0 ? services[0]?.autoStart ?? true : true));
  const [focusedField, setFocusedField] = useState<WizardFormField>('name');
  const [error, setError] = useState<string | null>(null);

  // Load a service into the right-hand form
  const loadServiceToForm = useCallback((svc: ServiceConfig) => {
    setName(svc.name);
    setPathValue(svc.path);
    setCommand(Array.isArray(svc.command) ? svc.command.join(' && ') : (svc.command || ''));
    setPort(svc.port ? String(svc.port) : '');
    setAutoStart(svc.autoStart !== false);
    setError(null);
  }, []);

  // Apply one-click architecture preset
  const handleApplyPreset = useCallback((preset: ArchitecturePreset) => {
    setServices(preset.services);
    setSelectedIndex(0);
    setIsEditingNew(false);
    loadServiceToForm(preset.services[0]!);
    setActivePanel('services');
    setError(null);
  }, [loadServiceToForm]);

  // Reset form to blank for registering a new service
  const handleStartAddService = useCallback(() => {
    setIsEditingNew(true);
    setName('');
    setPathValue('');
    setCommand('npm run dev');
    setPort('');
    setAutoStart(true);
    setFocusedField('name');
    setActivePanel('form');
    setNarrowTab('form');
    setError(null);
  }, []);

  // Remove selected service from list
  const handleRemoveSelectedService = useCallback(() => {
    if (services.length === 0) return;
    const nextServices = services.filter((_, idx) => idx !== selectedIndex);
    setServices(nextServices);
    if (nextServices.length === 0) {
      handleStartAddService();
    } else {
      const nextIdx = Math.max(0, Math.min(selectedIndex, nextServices.length - 1));
      setSelectedIndex(nextIdx);
      loadServiceToForm(nextServices[nextIdx]!);
      setIsEditingNew(false);
    }
  }, [services, selectedIndex, handleStartAddService, loadServiceToForm]);

  // Form submission / validation
  const handleFormSubmit = useCallback(() => {
    if (!name.trim()) {
      setError('Service name is required');
      setFocusedField('name');
      setActivePanel('form');
      return;
    }
    if (!pathValue.trim()) {
      setError('Folder path is required');
      setFocusedField('path');
      setActivePanel('form');
      return;
    }
    if (!command.trim()) {
      setError('Start command is required');
      setFocusedField('command');
      setActivePanel('form');
      return;
    }

    const parsedPort = port.trim() ? parseInt(port.trim(), 10) : undefined;
    if (port.trim() && (isNaN(parsedPort!) || parsedPort! <= 0 || parsedPort! > 65535)) {
      setError('Port must be a valid number between 1 and 65535');
      setFocusedField('port');
      setActivePanel('form');
      return;
    }

    const savedService: ServiceConfig = {
      name: name.trim(),
      path: pathValue.trim(),
      command: command.trim(),
      port: parsedPort,
      autoStart
    };

    if (isEditingNew) {
      setServices(prev => [...prev, savedService]);
      setSelectedIndex(services.length);
      setIsEditingNew(false);
    } else {
      setServices(prev => prev.map((s, idx) => (idx === selectedIndex ? savedService : s)));
    }

    setError(null);
    setActivePanel('services');
  }, [name, pathValue, command, port, autoStart, isEditingNew, selectedIndex, services.length]);

  // Save devpulse.config.json and launch DevPulse dashboard
  const handleSaveAndLaunch = useCallback(() => {
    if (services.length === 0) {
      setError('Please add at least one service before launching');
      setActivePanel('form');
      return;
    }

    const config: DevPulseConfig = {
      $schema: 'https://devpulse.dev/schema.json',
      name: process.cwd().split('/').pop() || 'Workspace',
      version: '1.0.0',
      services
    };

    saveConfigFile(config, process.cwd(), configFilePath);
    onComplete(config);
  }, [services, onComplete, configFilePath]);

  // Apply auto-detected suggestion
  const handleApplySuggestion = useCallback((sug: Partial<ServiceConfig>) => {
    if (sug.name) setName(sug.name);
    if (sug.path) setPathValue(sug.path);
    if (sug.command) setCommand(Array.isArray(sug.command) ? sug.command.join(' && ') : sug.command);
    if (sug.port) setPort(String(sug.port));
    if (sug.autoStart !== undefined) setAutoStart(sug.autoStart);
    setError(null);
  }, []);

  // Layout calculations
  const isUltraNarrow = viewport.width < 75;
  const isWide = viewport.width >= 105;
  const leftPanelWidth = isUltraNarrow
    ? viewport.width
    : isWide
      ? Math.min(42, Math.floor(viewport.width * 0.35))
      : 32;
  const rightPanelWidth = isUltraNarrow
    ? viewport.width
    : viewport.width - leftPanelWidth - 1;

  const contentHeight = Math.max(16, viewport.height - 2);

  // Keyboard and SGR Mouse Input Orchestration
  useInput((input, key) => {
    // -------------------------------------------------------------
    // 1. SGR Mouse Reporting Parser: [<button;x;yM
    // -------------------------------------------------------------
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
          // Dynamic click routing via ClickManager! Zero manual coordinate math!
          clickManagerRef.current?.dispatchClick(mouseX, mouseY);
        }
      }

      if (handledMouse) return;
    }

    // -------------------------------------------------------------
    // 2. Escape: Reset new edit or exit
    // -------------------------------------------------------------
    if (key.escape) {
      if (isEditingNew && services.length > 0) {
        setIsEditingNew(false);
        loadServiceToForm(services[selectedIndex] || services[0]!);
        setActivePanel('services');
      } 
      return;
    }

    // -------------------------------------------------------------
    // 3. Tab switching between Left & Right panels or fields
    // -------------------------------------------------------------
    if (key.tab) {
      if (isUltraNarrow) {
        setNarrowTab(prev => (prev === 'services' ? 'form' : 'services'));
        return;
      }

      if (activePanel === 'services') {
        setActivePanel('form');
        setFocusedField('name');
      } else {
        const curIdx = FORM_FIELDS.indexOf(focusedField);
        if (key.shift) {
          if (curIdx === 0) {
            setActivePanel('services');
          } else {
            setFocusedField(FORM_FIELDS[curIdx - 1]!);
          }
        } else {
          if (curIdx === FORM_FIELDS.length - 1) {
            setActivePanel('services');
          } else {
            setFocusedField(FORM_FIELDS[curIdx + 1]!);
          }
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // 4. Panel-specific navigation and typing
    // -------------------------------------------------------------
    if (activePanel === 'services') {
      // Shortcuts on services panel
      if (input === 'a' || input === '+') {
        handleStartAddService();
        return;
      }
      if (input === 'd') {
        handleRemoveSelectedService();
        return;
      }
      if (input === 's') {
        handleSaveAndLaunch();
        return;
      }
      if (key.upArrow || input === 'k') {
        if (services.length > 0) {
          const nextIdx = Math.max(0, selectedIndex - 1);
          setSelectedIndex(nextIdx);
          setIsEditingNew(false);
          loadServiceToForm(services[nextIdx]!);
        }
        return;
      }
      if (key.downArrow || input === 'j') {
        if (services.length > 0) {
          const nextIdx = Math.min(services.length - 1, selectedIndex + 1);
          setSelectedIndex(nextIdx);
          setIsEditingNew(false);
          loadServiceToForm(services[nextIdx]!);
        }
        return;
      }
      if (key.return) {
        setActivePanel('form');
        setFocusedField('name');
        return;
      }
    } else {
      // Form panel interaction
      if (key.upArrow) {
        const curIdx = FORM_FIELDS.indexOf(focusedField);
        setFocusedField(FORM_FIELDS[Math.max(0, curIdx - 1)]!);
        return;
      }
      if (key.downArrow) {
        const curIdx = FORM_FIELDS.indexOf(focusedField);
        setFocusedField(FORM_FIELDS[Math.min(FORM_FIELDS.length - 1, curIdx + 1)]!);
        return;
      }

      // Enter submission
      if (key.return) {
        if (focusedField === 'saveBtn') {
          handleFormSubmit();
        } else if (focusedField === 'autoStart') {
          setAutoStart(prev => !prev);
        } else {
          const curIdx = FORM_FIELDS.indexOf(focusedField);
          if (curIdx === FORM_FIELDS.length - 2) {
            handleFormSubmit();
          } else {
            setFocusedField(FORM_FIELDS[curIdx + 1]!);
          }
        }
        return;
      }

      // Space toggles autoStart
      if (focusedField === 'autoStart' && (input === ' ' || input === 'x')) {
        setAutoStart(prev => !prev);
        return;
      }

      // Text input editing
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
      }
    }
  });

  return (
    <ClickProvider clickManagerRef={clickManagerRef}>
      <Box 
        flexDirection="column" 
        width={viewport.width} 
        height={viewport.height}
        backgroundColor={theme.colors.canvas}
        paddingX={0}
        paddingY={0}
      >
        {/* 1. Header Bar (Row 1) */}
        <Header 
          time={time} 
          systemStatus="Workspace Setup" 
          width={viewport.width}
        />

        {/* 2. Main Setup Area */}
        {isUltraNarrow ? (
          /* Ultra-Narrow Single Column View with Top Switcher */
          <Box flexDirection="column" width={viewport.width} flexGrow={1}>
            <Box flexDirection="row" marginBottom={0} paddingX={1} flexWrap="nowrap">
              <Clickable id="tab-nav-services" onClick={() => setNarrowTab('services')}>
                <Text 
                  color={narrowTab === 'services' ? theme.colors.accent : theme.colors.textMuted} 
                  bold={narrowTab === 'services'}
                >
                  [1: Services ({services.length})]{' '}
                </Text>
              </Clickable>
              <Clickable id="tab-nav-form" onClick={() => setNarrowTab('form')}>
                <Text 
                  color={narrowTab === 'form' ? theme.colors.accent : theme.colors.textMuted} 
                  bold={narrowTab === 'form'}
                >
                  [2: Service Form]
                </Text>
              </Clickable>
            </Box>
            {narrowTab === 'services' ? (
              <WizardRegistryPanel 
                services={services}
                selectedIndex={selectedIndex}
                isEditingNew={isEditingNew}
                isFocused={true}
                panelWidth={viewport.width}
                contentHeight={contentHeight}
                isUltraNarrow={true}
                presets={ARCHITECTURE_PRESETS}
                workspaceName={workspaceName}
                configFilename={activeConfigFilename}
                onSelectService={(idx) => {
                  setSelectedIndex(idx);
                  setIsEditingNew(false);
                  if (services[idx]) loadServiceToForm(services[idx]);
                  setActivePanel('services');
                }}
                onAddService={handleStartAddService}
                onRemoveService={handleRemoveSelectedService}
                onSaveAndLaunch={handleSaveAndLaunch}
                onApplyPreset={handleApplyPreset}
              />
            ) : (
              <WizardFormPanel 
                isEditingNew={isEditingNew}
                editingIndex={selectedIndex}
                totalServices={services.length}
                name={name}
                pathValue={pathValue}
                command={command}
                port={port}
                autoStart={autoStart}
                focusedField={focusedField}
                isFocused={true}
                error={error}
                suggestions={detected}
                panelWidth={viewport.width}
                contentHeight={contentHeight}
                isUltraNarrow={true}
                onFocusField={(field) => {
                  setFocusedField(field);
                  setActivePanel('form');
                }}
                onToggleAutoStart={() => {
                  setFocusedField('autoStart');
                  setAutoStart(prev => !prev);
                  setActivePanel('form');
                }}
                onApplySuggestion={handleApplySuggestion}
                onSubmit={handleFormSubmit}
                onClear={handleStartAddService}
              />
            )}
          </Box>
        ) : (
          /* Standard 2-Column Responsive Setup View matching DevPulse synergy */
          <Box flexDirection="row" width={viewport.width}>
            {/* Left Column: Service Registry & Multiplier Actions */}
            <Box flexDirection="column" width={leftPanelWidth} marginRight={1}>
              <WizardRegistryPanel 
                services={services}
                selectedIndex={selectedIndex}
                isEditingNew={isEditingNew}
                isFocused={activePanel === 'services'}
                panelWidth={leftPanelWidth}
                contentHeight={contentHeight}
                presets={ARCHITECTURE_PRESETS}
                workspaceName={workspaceName}
                configFilename={activeConfigFilename}
                onSelectService={(idx) => {
                  setSelectedIndex(idx);
                  setIsEditingNew(false);
                  if (services[idx]) loadServiceToForm(services[idx]);
                  setActivePanel('services');
                }}
                onAddService={handleStartAddService}
                onRemoveService={handleRemoveSelectedService}
                onSaveAndLaunch={handleSaveAndLaunch}
                onApplyPreset={handleApplyPreset}
              />
            </Box>

            {/* Right Column: Service Form & Configuration */}
            <Box flexDirection="column" width={rightPanelWidth}>
              <WizardFormPanel 
                isEditingNew={isEditingNew}
                editingIndex={selectedIndex}
                totalServices={services.length}
                name={name}
                pathValue={pathValue}
                command={command}
                port={port}
                autoStart={autoStart}
                focusedField={focusedField}
                isFocused={activePanel === 'form'}
                error={error}
                suggestions={detected}
                panelWidth={rightPanelWidth}
                contentHeight={contentHeight}
                onFocusField={(field) => {
                  setFocusedField(field);
                  setActivePanel('form');
                }}
                onToggleAutoStart={() => {
                  setFocusedField('autoStart');
                  setAutoStart(prev => !prev);
                  setActivePanel('form');
                }}
                onApplySuggestion={handleApplySuggestion}
                onSubmit={handleFormSubmit}
                onClear={handleStartAddService}
              />
            </Box>
          </Box>
        )}

        {/* 3. Footer Bar (Bottom Row) */}
        <WizardFooter width={viewport.width} />
      </Box>
    </ClickProvider>
  );
};

export default SetupWizard;
