#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box } from 'ink';
import DevPulse from './DevPulse.js';
import SetupWizard from './components/wizard/SetupWizard.js';
import ConfigSelectorScreen from './components/selector/ConfigSelectorScreen.js';
import NoConfigWelcomeScreen from './components/welcome/NoConfigWelcomeScreen.js';
import LoadingScreen from './components/common/LoadingScreen.js';
import { useTerminalViewport } from './hooks/useTerminalViewport.js';
import {
  loadConfigFile,
  hasConfigFile,
  getConfigFilePath,
  parseCliArgs,
  getConfigFileSummaries,
  getConfigFileSummariesAsync,
  resolveInitialAppState,
  ConfigFileSummary
} from './services/configManager.js';
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

let isCleanedUp = false;
const cleanup = () => {
  if (isCleanedUp) return;
  isCleanedUp = true;
  try {
    processManager.stopAllSync();
  } catch {}
  try {
    // Complete atomic restoration: reset colors, disable mouse, show cursor, leave alternate buffer
    process.stdout.write(theme.ansi.restoreScreen);
  } catch {}
};

process.once('exit', cleanup);
process.once('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.once('SIGTERM', () => {
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
  // Initialize canvas background (TrueColor BCE) strictly on alternate screen buffer on mount and resize
  useEffect(() => {
    try {
      process.stdout.write(`\x1b[?1049h${theme.ansi.initScreen}\x1b[?1000h\x1b[?1006h\x1b[?25l`);
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

  const viewport = useTerminalViewport();

  const initialSyncState = cliArgs.configPath
    ? resolveInitialAppState(cliArgs, process.cwd())
    : null;

  const [summaries, setSummaries] = useState<ConfigFileSummary[]>(
    () => initialSyncState?.summaries || []
  );

  const [activeConfigPath, setActiveConfigPath] = useState<string | null>(
    () => initialSyncState?.activeConfigPath || null
  );

  const [config, setConfig] = useState<DevPulseConfig | null>(
    () => initialSyncState?.config || null
  );

  const [mode, setMode] = useState<'loading' | 'dashboard' | 'wizard' | 'selector' | 'welcome'>(
    () => (initialSyncState ? initialSyncState.mode : 'loading')
  );

  const [showLoading, setShowLoading] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(10);
  const [scanStatus, setScanStatus] = useState<string>('Scanning workspace for configuration profiles...');

  useEffect(() => {
    if (cliArgs.configPath) {
      return;
    }

    let isMounted = true;
    const thresholdTimer = setTimeout(() => {
      if (isMounted) {
        setShowLoading(true);
      }
    }, 120);

    getConfigFileSummariesAsync(process.cwd(), (percent, statusText) => {
      if (isMounted) {
        setScanProgress(percent);
        setScanStatus(statusText);
      }
    })
      .then((asyncSummaries) => {
        if (!isMounted) return;
        clearTimeout(thresholdTimer);
        const resolved = resolveInitialAppState(cliArgs, process.cwd(), asyncSummaries);
        setSummaries(resolved.summaries);
        setActiveConfigPath(resolved.activeConfigPath);
        setConfig(resolved.config);
        setMode(resolved.mode);
      })
      .catch((err) => {
        if (!isMounted) return;
        clearTimeout(thresholdTimer);
        logger.error(`Async config discovery error: ${err}`);
        setMode('welcome');
      });

    return () => {
      isMounted = false;
      clearTimeout(thresholdTimer);
    };
  }, []);

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
    const resolved = resolveInitialAppState(cliArgs, process.cwd(), freshSummaries);
    setSummaries(resolved.summaries);
    setActiveConfigPath(resolved.activeConfigPath);
    setConfig(resolved.config);
    setMode(resolved.mode);
  };

  const handleWizardComplete = (newConfig: DevPulseConfig) => {
    setConfig(newConfig);
    const refreshed = getConfigFilePath(process.cwd());
    if (refreshed) setActiveConfigPath(refreshed);
    setMode('dashboard');
  };

  if (mode === 'loading') {
    if (!showLoading) {
      return (
        <Box
          width={viewport.width}
          height={viewport.height}
          backgroundColor={theme.colors.canvas}
        />
      );
    }
    return (
      <LoadingScreen
        progress={scanProgress}
        statusText={scanStatus}
        width={viewport.width}
        height={viewport.height}
      />
    );
  }

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
