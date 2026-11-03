#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import DevPulse from './DevPulse.js';
import SetupWizard from './components/wizard/SetupWizard.js';
import ConfigSelectorScreen from './components/selector/ConfigSelectorScreen.js';
import NoConfigWelcomeScreen from './components/welcome/NoConfigWelcomeScreen.js';
import { loadConfigFile, hasConfigFile, getConfigFilePath, parseCliArgs, getConfigFileSummaries, ConfigFileSummary } from './services/configManager.js';
import { processManager } from './services/processManager.js';
import { DevPulseConfig } from './types/config.js';
import { theme } from './theme/theme.js';
import { logger } from './logger/logger.js';

// 0. Handle CLI Help & Version flags before any terminal buffer initialization
const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`
DevPulse - Modern Terminal Workspace Orchestrator for Multi-Service Apps

Usage:
  devpulse [options] [config-file]

Options:
  -c, --config <file>   Specify a custom DevPulse config file
  -h, --help            Show this help message
  -v, --version         Show DevPulse version

Controls:
  ↑/↓ or j/k            Navigate services
  Enter                 Inspect service logs / details
  r                     Restart selected service
  s                     Stop or Start selected service
  1 / 2                 Switch tabs (Logs, Errors)
  /                     Search logs
  f                     Cycle service filter
  Space / l             Toggle live streaming
  q / Ctrl+C            Exit DevPulse
`);
  process.exit(0);
}

if (args.includes('-v') || args.includes('--version')) {
  console.log('devpulse v1.0.0');
  process.exit(0);
}

if (!process.stdout.isTTY) {
  console.error('Error: DevPulse requires an interactive TTY terminal to run.');
  process.exit(1);
}

// 1. Initialize canvas background (24-bit TrueColor BCE + OSC 11), home cursor, and enable SGR mouse reporting
process.stdout.write(`${theme.ansi.initScreen}\x1b[?1000h\x1b[?1006h\x1b[?25l`);

const cleanup = () => {
  try {
    processManager.stopAllSync();
  } catch {}
  try {
    process.stdout.write(`${theme.ansi.restoreScreen}\x1b[?1000l\x1b[?1006l\x1b[?25h`);
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
  // Guarantee alternate screen buffer has canvas background (OSC 11 + TrueColor BCE) applied on mount and resize
  useEffect(() => {
    try {
      process.stdout.write(`${theme.ansi.initScreen}\x1b[?1000h\x1b[?1006h\x1b[?25l`);
    } catch {}

    const handleResize = () => {
      try {
        process.stdout.write(theme.ansi.initScreen);
      } catch {}
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

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

  const [mode, setMode] = useState<'dashboard' | 'wizard' | 'selector' | 'welcome'>(() => {
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
    return 'welcome';
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
    } else if (freshSummaries.length === 1) {
      setMode('dashboard');
    } else {
      setMode('welcome');
    }
  };

  const handleWizardComplete = (newConfig: DevPulseConfig) => {
    setConfig(newConfig);
    const refreshed = getConfigFilePath(process.cwd());
    if (refreshed) setActiveConfigPath(refreshed);
    setMode('dashboard');
  };

  if (mode === 'welcome') {
    return (
      <NoConfigWelcomeScreen
        onCreateNew={() => setMode('wizard')}
        onCancel={() => {
          cleanup();
          process.exit(0);
        }}
      />
    );
  }

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
          } else if (summaries.length === 1) {
            setMode('dashboard');
          } else {
            setMode('welcome');
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
