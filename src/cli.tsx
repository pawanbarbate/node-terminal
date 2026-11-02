#!/usr/bin/env node
import React, { useState } from 'react';
import { Box, Text, render } from 'ink';
import DevPulse from './DevPulse.js';
import SetupWizard from './components/wizard/SetupWizard.js';
import ConfigSelectorScreen from './components/selector/ConfigSelectorScreen.js';
import CommandTrustScreen from './components/CommandTrustScreen.js';
import { loadConfigFile, hasConfigFile, getConfigFilePath, parseCliArgs, getConfigFileSummaries, ConfigFileSummary } from './services/configManager.js';
import { processManager } from './services/processManager.js';
import { DevPulseConfig } from './types/config.js';
import { theme } from './theme/theme.js';
import { logger } from './logger/logger.js';

const interactiveTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const screenReaderMode = process.env.INK_SCREEN_READER === 'true';
const terminalControlsSupported = process.env.TERM !== 'dumb' && !screenReaderMode;
const canvasBackgroundControlsSupported = terminalControlsSupported;
const mouseModes = terminalControlsSupported ? '\x1b[?1000h\x1b[?1006h' : '';
const restoreMouseModes = terminalControlsSupported ? '\x1b[?1000l\x1b[?1006l' : '';
let terminalModesActive = false;
let cleanupComplete = false;

function writeTerminalControl(sequence: string, operation: string): void {
  if (!sequence) return;
  try {
    process.stdout.write(sequence);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to ${operation}: ${message}`);
  }
}

const cleanup = () => {
  if (cleanupComplete) return;
  cleanupComplete = true;
  processManager.stopAllSync();
  if (!terminalModesActive) return;
  writeTerminalControl(
    `${canvasBackgroundControlsSupported ? theme.ansi.resetCanvasBg : ''}${restoreMouseModes}${terminalControlsSupported ? '\x1b[?1049l\x1b[?25h' : ''}`,
    'restore terminal state'
  );
  terminalModesActive = false;
};
process.once('exit', cleanup);
process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

if (!interactiveTerminal) {
  console.error('DevPulse requires an interactive TTY. Run it from a terminal with stdin and stdout attached.');
  process.exit(1);
}

terminalModesActive = true;
writeTerminalControl(
  `${terminalControlsSupported ? '\x1b[?1049h' : ''}${canvasBackgroundControlsSupported ? theme.ansi.setCanvasBg : ''}${terminalControlsSupported ? '\x1b[H\x1b[?25l' : ''}${mouseModes}`,
  'enter interactive terminal mode'
);

const cliArgs = parseCliArgs();
if (cliArgs.configPath && !hasConfigFile(cliArgs.configPath)) {
  cleanup();
  console.error(`\x1b[31mError: Specified configuration file not found: ${cliArgs.configPath}\x1b[0m`);
  process.exit(1);
}
const explicitConfig = cliArgs.configPath ? loadConfigFile(cliArgs.configPath) : null;
if (cliArgs.configPath && !explicitConfig) {
  cleanup();
  console.error(`\x1b[31mError: Configuration is invalid: ${cliArgs.configPath}\x1b[0m`);
  process.exit(1);
}

const App: React.FC = () => {
  const [summaries, setSummaries] = useState<ConfigFileSummary[]>(() =>
    !cliArgs.configPath ? getConfigFileSummaries(process.cwd()) : []
  );

  const [activeConfigPath, setActiveConfigPath] = useState<string | null>(() => {
    if (cliArgs.configPath) {
      return getConfigFilePath(cliArgs.configPath);
    }
    const currentSummaries = getConfigFileSummaries(process.cwd());
    if (currentSummaries.length === 1 && currentSummaries[0]) {
      return currentSummaries[0].path;
    }
    return null;
  });
  const [returnToDashboard, setReturnToDashboard] = useState(false);
  const [dashboardConfigPath, setDashboardConfigPath] = useState<string | null>(null);

  const [config, setConfig] = useState<DevPulseConfig | null>(() => {
    if (cliArgs.configPath) return explicitConfig;
    const currentSummaries = getConfigFileSummaries(process.cwd());
    if (currentSummaries.length === 1 && currentSummaries[0]) {
      return loadConfigFile(currentSummaries[0].path);
    }
    return null;
  });

  const [mode, setMode] = useState<'dashboard' | 'wizard' | 'selector' | 'trust'>(() => {
    if (cliArgs.configPath) {
      return 'trust';
    }
    const currentSummaries = getConfigFileSummaries(process.cwd());
    if (currentSummaries.length > 1) {
      return 'selector';
    }
    if (currentSummaries.length === 1 && currentSummaries[0]) {
      const singleConfig = loadConfigFile(currentSummaries[0].path);
      if (singleConfig) return 'trust';
      return 'selector';
    }
    return 'wizard';
  });

  const handleSelectProfile = (chosenPath: string) => {
    const loaded = loadConfigFile(chosenPath);
    if (loaded) {
      setActiveConfigPath(chosenPath);
      setConfig(loaded);
      setMode('trust');
    }
  };

  const handleSwitchConfig = () => {
    // Terminate any running child service processes cleanly before switching
    try {
      processManager.stopAllSync();
    } catch {}

    const freshSummaries = getConfigFileSummaries(process.cwd());
    setSummaries(freshSummaries);
    if (freshSummaries.length > 1) {
      setMode('selector');
    } else if (freshSummaries.length === 1 && freshSummaries[0]?.isValid) {
      const selectedPath = freshSummaries[0].path;
      const selectedConfig = loadConfigFile(selectedPath);
      if (selectedConfig) {
        setActiveConfigPath(selectedPath);
        setConfig(selectedConfig);
        setMode('trust');
      }
    } else {
      setActiveConfigPath(null);
      setMode('wizard');
    }
  };

  const handleWizardComplete = (newConfig: DevPulseConfig, savedPath: string) => {
    setReturnToDashboard(false);
    setConfig(newConfig);
    setActiveConfigPath(savedPath);
    setMode('trust');
  };

  const handleTrustCancel = () => {
    const freshSummaries = getConfigFileSummaries(process.cwd());
    if (freshSummaries.length > 0) {
      setSummaries(freshSummaries);
      setMode('selector');
    } else {
      cleanup();
      process.exit(0);
    }
  };

  if (mode === 'trust' && config && activeConfigPath) {
    return (
      <CommandTrustScreen
        config={config}
        configPath={activeConfigPath}
        onApprove={() => setMode('dashboard')}
        onCancel={handleTrustCancel}
      />
    );
  }

  if (mode === 'selector') {
    return (
      <ConfigSelectorScreen
        configs={summaries}
        onSelect={handleSelectProfile}
        onNewConfig={() => {
          setReturnToDashboard(false);
          setActiveConfigPath(null);
          setMode('wizard');
        }}
        onCancel={() => {
          cleanup();
          process.exit(0);
        }}
      />
    );
  }

  if (mode === 'trust') {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color={theme.colors.stopped}>Cannot load a valid configuration. No services were started.</Text>
      </Box>
    );
  }

  if (mode === 'wizard') {
    return (
      <SetupWizard 
        onComplete={handleWizardComplete} 
        configFilePath={activeConfigPath || undefined}
        initialConfig={activeConfigPath ? config || undefined : undefined}
        onCancel={() => {
          if (returnToDashboard) {
            setActiveConfigPath(dashboardConfigPath);
            setReturnToDashboard(false);
            setMode('dashboard');
          } else if (summaries.length > 1) {
            setMode('selector');
          } else {
            cleanup();
            process.exit(0);
          }
        }}
      />
    );
  }

  return (
    <DevPulse 
      config={config || undefined} 
      onEditProfile={() => {
        setDashboardConfigPath(activeConfigPath);
        setReturnToDashboard(true);
        setMode('wizard');
      }}
      onNewProfile={() => {
        setDashboardConfigPath(activeConfigPath);
        setReturnToDashboard(true);
        setActiveConfigPath(null);
        setMode('wizard');
      }}
      onSwitchConfig={handleSwitchConfig}
    />
  );
};

const { waitUntilExit } = render(<App />, {
  alternateScreen: terminalControlsSupported,
  exitOnCtrlC: true
});

waitUntilExit()
  .then(() => cleanup())
  .catch((err: unknown) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
