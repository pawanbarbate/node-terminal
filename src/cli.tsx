#!/usr/bin/env node
import React, { useState } from 'react';
import { render } from 'ink';
import DevPulse from './DevPulse.js';
import SetupWizard from './components/wizard/SetupWizard.js';
import ConfigSelectorScreen from './components/selector/ConfigSelectorScreen.js';
import { loadConfigFile, hasConfigFile, getConfigFilePath, parseCliArgs, getConfigFileSummaries, ConfigFileSummary } from './services/configManager.js';
import { processManager } from './services/processManager.js';
import { DevPulseConfig } from './types/config.js';
import { theme } from './theme/theme.js';
import { logger } from './logger/logger.js';

// 1. Enter alternate screen buffer first
// 2. Set universal canvas background (OSC 11 + 24-bit TrueColor BCE: #0B0F19)
// 3. Home cursor to row 1, col 1, hide cursor, and enable clean SGR mouse click & wheel reporting
process.stdout.write(`\x1b[?1049h${theme.ansi.setCanvasBg}\x1b[H\x1b[?1000h\x1b[?1006h\x1b[?25l`);

const cleanup = () => {
  // Terminate any active process trees immediately
  try {
    processManager.stopAllSync();
  } catch {}
  // Reset terminal background color (OSC 111 + ANSI attribute reset), disable mouse reporting, exit alternate screen, and restore cursor
  try {
    process.stdout.write(`${theme.ansi.resetCanvasBg}\x1b[?1000l\x1b[?1006l\x1b[?1049l\x1b[?25h`);
  } catch {}
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

const cliArgs = parseCliArgs();
if (cliArgs.configPath && !hasConfigFile(cliArgs.configPath)) {
  cleanup();
  console.error(`\x1b[31mError: Specified configuration file not found: ${cliArgs.configPath}\x1b[0m`);
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

  const [config, setConfig] = useState<DevPulseConfig | null>(() => {
    if (cliArgs.configPath) {
      return loadConfigFile(cliArgs.configPath);
    }
    const currentSummaries = getConfigFileSummaries(process.cwd());
    if (currentSummaries.length === 1 && currentSummaries[0]) {
      return loadConfigFile(currentSummaries[0].path);
    }
    return null;
  });

  const [mode, setMode] = useState<'dashboard' | 'wizard' | 'selector'>(() => {
    if (cliArgs.configPath) {
      return hasConfigFile(cliArgs.configPath) ? 'dashboard' : 'wizard';
    }
    const currentSummaries = getConfigFileSummaries(process.cwd());
    if (currentSummaries.length > 1) {
      return 'selector';
    }
    if (currentSummaries.length === 1 && currentSummaries[0]) {
      const singleConfig = loadConfigFile(currentSummaries[0].path);
      if (singleConfig) return 'dashboard';
    }
    return 'wizard';
  });

  const handleSelectProfile = (chosenPath: string) => {
    const loaded = loadConfigFile(chosenPath);
    if (loaded) {
      setActiveConfigPath(chosenPath);
      setConfig(loaded);
      setMode('dashboard');
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
    } else {
      setMode('wizard');
    }
  };

  const handleWizardComplete = (newConfig: DevPulseConfig) => {
    setConfig(newConfig);
    const refreshed = getConfigFilePath(process.cwd());
    if (refreshed) setActiveConfigPath(refreshed);
    setMode('dashboard');
  };

  if (mode === 'selector') {
    return (
      <ConfigSelectorScreen
        configs={summaries}
        onSelect={handleSelectProfile}
        onNewConfig={() => setMode('wizard')}
        onCancel={() => {
          cleanup();
          process.exit(0);
        }}
      />
    );
  }

  if (mode === 'wizard') {
    return (
      <SetupWizard 
        onComplete={handleWizardComplete} 
        configFilePath={activeConfigPath || undefined}
        onCancel={() => {
          if (summaries.length > 1) {
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
      onOpenConfig={() => setMode('wizard')}
      onSwitchConfig={handleSwitchConfig}
    />
  );
};

const { waitUntilExit } = render(<App />, {
  alternateScreen: true,
  exitOnCtrlC: true
});

waitUntilExit()
  .then(() => cleanup())
  .catch((err: unknown) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
