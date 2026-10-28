/**
 * DevPulse Design System: "Midnight Slate"
 * Modern, high-contrast, professional developer terminal UI tokens
 */

export const theme = {
  colors: {
    // Canvas & Surfaces (Refined Midnight Slate Palette)
    canvas: '#0B0F19',          // Deep midnight canvas (RGB: 11, 15, 25)
    surface: '#0F172A',         // Rich slate 900 panel container
    card: '#1E293B',            // Elevated slate 800 card / active item surface
    cardHover: '#26334B',       // Selection / hover highlight
    cardSelected: '#1E293B',     // Selected service row background

    // Borders & Dividers
    borderDefault: '#1E293B',   // Crisp, high-contrast slate border
    borderFocus: '#38BDF8',     // Sky blue focus border (high clarity, calm)
    borderSubtle: '#172033',    // Internal micro-dividers

    // Typography Hierarchy (WCAG AAA contrast against #0F172A & #0B0F19)
    textPrimary: '#FFFFFF',     // Pure crisp white for active titles, service names
    textSecondary: '#CBD5E1',   // Soft slate 300 for commands, ports, metadata
    textMuted: '#94A3B8',       // Slate 400 for timestamps, labels, shortcuts (5.8:1 contrast!)
    textDim: '#64748B',         // Slate 500 for column separators (│, ·)

    // Brand Accent & Highlights
    accent: '#38BDF8',          // Sky blue brand signature (high clarity)
    accentDark: '#0C4A6E',      // Deep sky blue background for active pills
    secondaryAccent: '#818CF8', // Soft indigo accent

    // Status Colors (Vibrant but cohesive)
    running: '#22C55E',         // Emerald green (RUNNING, healthy)
    runningBg: '#064E3B',       // Deep emerald glass background
    stopped: '#EF4444',         // Coral red (STOPPED, errors)
    stoppedBg: '#7F1D1D',       // Deep red background
    warning: '#F59E0B',         // Amber gold (STARTING, RESTARTING)
    warningBg: '#78350F',       // Deep amber background
  },

  // Curated Microservice Log Badges Palette (Balanced, readable badges)
  badges: [
    { bg: '#0369A1', fg: '#FFFFFF' }, // Sky Blue
    { bg: '#047857', fg: '#FFFFFF' }, // Emerald Green
    { bg: '#6D28D9', fg: '#FFFFFF' }, // Purple
    { bg: '#B45309', fg: '#FFFFFF' }, // Amber
    { bg: '#BE123C', fg: '#FFFFFF' }, // Rose Red
    { bg: '#0F766E', fg: '#FFFFFF' }, // Teal
    { bg: '#4338CA', fg: '#FFFFFF' }, // Indigo
    { bg: '#C2410C', fg: '#FFFFFF' }, // Orange
  ],

  // Terminal ANSI Escape Sequences: Support BOTH OSC 11 and 24-bit TrueColor BCE
  ansi: {
    canvasRgb: [11, 15, 25] as const,
    // OSC 11 + 24-bit TrueColor Background Color Erase (\x1b[48;2;11;15;25m\x1b[2J)
    setCanvasBg: '\x1b]11;#0B0F19\x07\x1b[48;2;11;15;25m\x1b[2J',
    // OSC 111 + ANSI Attribute Reset (\x1b[0m\x1b[2J)
    resetCanvasBg: '\x1b]111\x07\x1b[0m\x1b[2J',
  }
} as const;

export type Theme = typeof theme;

/**
 * Returns a consistent badge color pair for any service name string
 */
export function getServiceBadgeStyle(serviceName: string) {
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = (hash << 5) - hash + serviceName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % theme.badges.length;
  const badge = theme.badges[index] || theme.badges[0]!;
  const cleanLabel = serviceName.toUpperCase().slice(0, 8);
  return {
    bg: badge.bg,
    fg: badge.fg,
    label: ` ${cleanLabel} `,
    cleanLabel,
    color: badge.bg
  };
}

export default theme;
