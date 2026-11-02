import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToString, Text } from 'ink';
import { useTerminalViewport } from '../src/hooks/useTerminalViewport.js';
import { appVersion } from '../src/version.js';

interface ViewportSnapshotProps {
  width: number;
  height: number;
}

const ViewportSnapshot: React.FC<ViewportSnapshotProps> = ({ width, height }) => {
  const viewport = useTerminalViewport(width, height);
  return <Text>{`${width}x${height}:${viewport.isTooSmall ? 'small' : 'supported'}`}</Text>;
};

assert.match(renderToString(<ViewportSnapshot width={59} height={18} />), /59x18:small/);
assert.match(renderToString(<ViewportSnapshot width={60} height={18} />), /60x18:supported/);
assert.match(renderToString(<ViewportSnapshot width={80} height={17} />), /80x17:small/);

const packageMetadata = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as { version: string };
assert.strictEqual(appVersion, packageMetadata.version);

console.log('Minimum terminal size is enforced and the displayed version matches package metadata.');
