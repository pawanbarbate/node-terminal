import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useId,
  useEffect,
  useImperativeHandle
} from 'react';
import { Box, measureElement, DOMElement } from 'ink';

export interface ClickableRegion {
  id: string;
  onClick: () => void;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  disabled?: boolean;
}

export interface ClickManagerContextValue {
  register: (region: ClickableRegion) => void;
  unregister: (id: string) => void;
  dispatchClick: (mouseX: number, mouseY: number) => boolean;
}

const ClickManagerContext = createContext<ClickManagerContextValue | null>(null);

export function useClickManager(): ClickManagerContextValue {
  const ctx = useContext(ClickManagerContext);
  if (!ctx) {
    throw new Error('useClickManager must be used within a ClickProvider');
  }
  return ctx;
}

export interface ClickProviderProps {
  children: React.ReactNode;
  clickManagerRef?: React.RefObject<ClickManagerContextValue | null>;
}

export const ClickProvider: React.FC<ClickProviderProps> = ({
  children,
  clickManagerRef
}) => {
  const regionsRef = useRef<Map<string, ClickableRegion>>(new Map());

  const register = useCallback((region: ClickableRegion) => {
    regionsRef.current.set(region.id, region);
  }, []);

  const unregister = useCallback((id: string) => {
    regionsRef.current.delete(id);
  }, []);

  const dispatchClick = useCallback((mouseX: number, mouseY: number): boolean => {
    // Find all registered regions that hit the mouse coordinates.
    // The region with the smallest area (deepest/innermost child element) takes precedence.
    let bestRegion: ClickableRegion | null = null;
    let minArea = Infinity;

    // Search in reverse order to break ties in favor of later-mounted components
    const regions = Array.from(regionsRef.current.values()).reverse();
    for (const region of regions) {
      if (region.disabled) continue;

      if (
        mouseX >= region.minX &&
        mouseX <= region.maxX &&
        mouseY >= region.minY &&
        mouseY <= region.maxY
      ) {
        const area = (region.maxX - region.minX + 1) * (region.maxY - region.minY + 1);
        if (area < minArea) {
          minArea = area;
          bestRegion = region;
        }
      }
    }

    if (bestRegion) {
      bestRegion.onClick();
      return true;
    }
    return false;
  }, []);

  const contextValue: ClickManagerContextValue = {
    register,
    unregister,
    dispatchClick
  };

  if (clickManagerRef) {
    (clickManagerRef as any).current = contextValue;
  }

  return (
    <ClickManagerContext.Provider value={contextValue}>
      {children}
    </ClickManagerContext.Provider>
  );
};

export interface ClickableProps extends React.ComponentProps<typeof Box> {
  id?: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export const Clickable: React.FC<ClickableProps> = ({
  id: propId,
  onClick,
  disabled = false,
  children,
  ...boxProps
}) => {
  const ref = useRef<DOMElement>(null);
  const autoId = useId();
  const id = propId || autoId;
  const { register, unregister } = useClickManager();

  const updateBounds = useCallback(() => {
    if (!ref.current || disabled) {
      unregister(id);
      return;
    }

    const measured = measureElement(ref.current);
    if (measured.width > 0 && measured.height > 0) {
      register({
        id,
        onClick,
        disabled,
        // measureElement returns 0-indexed layout coordinates relative to root.
        // Terminal SGR mouse coordinates are 1-indexed.
        minX: measured.x + 1,
        maxX: measured.x + measured.width,
        minY: measured.y + 1,
        maxY: measured.y + measured.height
      });
    }
  }, [id, onClick, disabled, register, unregister]);

  // Re-measure after every layout render pass so dynamic size/position updates register immediately
  useEffect(() => {
    updateBounds();
  });

  // Clean unregister on unmount
  useEffect(() => {
    return () => {
      unregister(id);
    };
  }, [id, unregister]);

  return (
    <Box ref={ref} {...boxProps}>
      {children}
    </Box>
  );
};

export default Clickable;
