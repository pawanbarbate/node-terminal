import React from 'react';
import assert from 'node:assert/strict';
import { render } from 'ink';
import { PassThrough } from 'stream';
import { ConfigSelectorScreen } from '../src/components/selector/ConfigSelectorScreen.js';
import { ConfigFileSummary } from '../src/services/configManager.js';

const createConfigs = (count: number): ConfigFileSummary[] => Array.from({ length: count }, (_, index) => ({
  path: `/workspace/profile-${index + 1}.devpulse.json`,
  filename: `profile-${index + 1}.devpulse.json`,
  name: `profile-${index + 1}`,
  servicesCount: 0,
  services: [],
  isValid: true
}));

const configs = createConfigs(4);
const partialRowConfigs = createConfigs(3);

async function selectAfterKeys(keys: string[], choices = configs): Promise<string | null> {
  const stdin = new PassThrough() as PassThrough & {
    isTTY: boolean;
    setRawMode: () => void;
    ref: () => void;
    unref: () => void;
  };
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};

  const stdout = new PassThrough() as PassThrough & {
    isTTY: boolean;
    columns: number;
    rows: number;
  };
  stdout.isTTY = true;
  stdout.columns = 100;
  stdout.rows = 30;

  let selectedPath: string | null = null;
  const { unmount } = render(
    <ConfigSelectorScreen
      configs={choices}
      onSelect={path => { selectedPath = path; }}
      onNewConfig={() => {}}
      onCancel={() => {}}
      width={100}
      height={30}
    />,
    { stdin, stdout }
  );

  await new Promise(resolve => setTimeout(resolve, 20));
  for (const key of keys) stdin.write(key);
  stdin.write('\r');
  await new Promise(resolve => setTimeout(resolve, 20));
  unmount();
  return selectedPath;
}

const rightArrow = '\x1b[C';
const leftArrow = '\x1b[D';
const downArrow = '\x1b[B';
const upArrow = '\x1b[A';

assert.equal(await selectAfterKeys([rightArrow]), configs[1]?.path, 'Right moves to the adjacent card');
assert.equal(await selectAfterKeys([downArrow]), configs[2]?.path, 'Down moves to the next grid row');
assert.equal(await selectAfterKeys([rightArrow, downArrow], partialRowConfigs), partialRowConfigs[2]?.path, 'Down from the right column clamps to the available card in the partial row');
assert.equal(await selectAfterKeys([rightArrow, leftArrow]), configs[0]?.path, 'Left returns to the first card');
assert.equal(await selectAfterKeys([rightArrow, downArrow, upArrow]), configs[1]?.path, 'Up returns to the same column');

console.log('✔ Grid arrows move immediately and correctly across rows, columns, and partial rows');
