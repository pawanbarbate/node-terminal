#!/usr/bin/env node
import React, { useState } from 'react';
import { render } from 'ink';
import DevPulse from './DevPulse.js';
import SetupWizard from './components/wizard/SetupWizard.js';
import { loadConfigFile, hasConfigFile } from './services/configManager.js';
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

const App: React.FC = () => {
  const [config, setConfig] = useState<DevPulseConfig | null>(() => loadConfigFile());
  const [mode, setMode] = useState<'dashboard' | 'wizard'>(() =>
    hasConfigFile() && config ? 'dashboard' : 'wizard'
  );


  const handleWizardComplete = (newConfig: DevPulseConfig) => {
    setConfig(newConfig);
    setMode('dashboard');
  };

  if (mode === 'wizard') {
    return (
      <SetupWizard 
        onComplete={handleWizardComplete} 
        onCancel={() => {
          cleanup();
          process.exit(0);
        }}
      />
    );
  }

  return (
    <DevPulse 
      config={config || undefined} 
      onOpenConfig={() => setMode('wizard')}
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
