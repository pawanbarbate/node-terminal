import React from 'react';
import { renderToString } from 'ink';
import { CommandTrustScreen } from '../src/components/CommandTrustScreen.js';
import { DevPulseConfig } from '../src/types/config.js';

const config: DevPulseConfig = {
  name: 'review-test',
  services: [
    {
      name: 'api',
      path: './services/api',
      preStart: ['npm run migrate'],
      command: 'npm run dev',
      autoStart: true
    },
    {
      name: 'worker',
      path: './services/worker',
      command: ['npm run build', 'npm start'],
      autoStart: false
    }
  ]
};

const output = renderToString(
  <CommandTrustScreen
    config={config}
    configPath='/workspace/config.devpulse.json'
    onApprove={() => {}}
    onCancel={() => {}}
  />
);

for (const expected of [
  'Review commands before running this profile',
  'Commands run with your user permissions',
  'npm run migrate',
  'npm run dev',
  'npm run build',
  'npm start',
  'worker (manual start)',
  'Approve for this session',
  'Cancel without starting services'
]) {
  if (!output.includes(expected)) throw new Error(`Command trust preview omitted: ${expected}`);
}

console.log('✔ Command trust preview lists startup commands and session approval controls');
