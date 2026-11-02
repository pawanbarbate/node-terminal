import { useState, useEffect } from 'react';
import { useStdout } from 'ink';
import { ViewportInfo } from '../types/index.js';

export const MIN_TERMINAL_WIDTH = 60;
export const MIN_TERMINAL_HEIGHT = 18;

const DEFAULT_TERMINAL_WIDTH = 80;
const DEFAULT_TERMINAL_HEIGHT = 24;

function validDimension(value: number | undefined, fallback: number): number {
  return value && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function useTerminalViewport(overrideWidth?: number, overrideHeight?: number): ViewportInfo {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: validDimension(overrideWidth ?? stdout?.columns, DEFAULT_TERMINAL_WIDTH),
    height: validDimension(overrideHeight ?? stdout?.rows, DEFAULT_TERMINAL_HEIGHT)
  });

  useEffect(() => {
    if (!stdout) return;
    const handleResize = () => {
      setDimensions({
        width: validDimension(overrideWidth ?? stdout.columns, DEFAULT_TERMINAL_WIDTH),
        height: validDimension(overrideHeight ?? stdout.rows, DEFAULT_TERMINAL_HEIGHT)
      });
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout, overrideWidth, overrideHeight]);

  const width = validDimension(overrideWidth ?? dimensions.width, DEFAULT_TERMINAL_WIDTH);
  const height = validDimension(overrideHeight ?? dimensions.height, DEFAULT_TERMINAL_HEIGHT);

  const isWide = width >= 115;
  const isUltraNarrow = width < 72;
  const isTooSmall = width < MIN_TERMINAL_WIDTH || height < MIN_TERMINAL_HEIGHT;
  const isUltraCompactHeight = height < 18;
  const isCompactHeight = height <= 25;

  // Strict Height Budgeting:
  // Header = 1 row, Footer = 1 row.
  // Content available height = height - 2 rows.
  const contentHeight = Math.max(10, height - 2);

  // Column Width Budgeting:
  // - Narrow (< 90): left = 28, right = width - 29
  // - Medium (90-115): left = 34, right = width - 35
  // - Wide (>= 115): left = 38, right = width - 39
  let leftPanelWidth = 28;
  if (width >= 115) {
    leftPanelWidth = 38;
  } else if (width >= 90) {
    leftPanelWidth = 34;
  } else {
    leftPanelWidth = Math.min(28, Math.max(22, Math.floor(width * 0.35)));
  }
  const rightPanelWidth = Math.max(30, width - leftPanelWidth - 1);

  // Dynamic Panel Heights & Log Line Budgeting (accounting for 1-row marginBottom):
  const systemPanelHeight = isUltraCompactHeight ? 3 : 8;
  const servicesPanelHeight = Math.max(4, contentHeight - systemPanelHeight - 1);

  // Right Column: Detail ~48%, Global Logs remainder (accounting for 1-row marginBottom)
  const detailPanelHeight = isUltraCompactHeight ? 5 : Math.max(6, Math.floor(contentHeight * 0.48));
  const globalLogsPanelHeight = Math.max(5, contentHeight - detailPanelHeight - 1);

  // Logs calculation
  let maxServiceLogs = Math.max(1, detailPanelHeight - 7);
  let maxGlobalLogs = Math.max(2, globalLogsPanelHeight - 4);

  if (isUltraCompactHeight) {
    maxServiceLogs = 1;
    maxGlobalLogs = 2;
  }

  return {
    width,
    height,
    isWide,
    isUltraNarrow,
    isTooSmall,
    isCompactHeight,
    isUltraCompactHeight,
    leftPanelWidth,
    rightPanelWidth,
    contentHeight,
    servicesPanelHeight,
    systemPanelHeight,
    detailPanelHeight,
    globalLogsPanelHeight,
    maxServiceLogs,
    maxGlobalLogs
  };
}
