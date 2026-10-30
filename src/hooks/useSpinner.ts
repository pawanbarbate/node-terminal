import { useState, useEffect } from 'react';

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * High-framerate braille spinner hook for terminal loading animations.
 * When active=false, interval is cleanly cleared, incurring 0 idle CPU overhead.
 */
export function useSpinner(active: boolean, intervalMs = 80): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % SPINNER_FRAMES.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return active ? SPINNER_FRAMES[frame]! : '●';
}

export default useSpinner;

