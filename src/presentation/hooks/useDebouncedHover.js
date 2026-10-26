import { useCallback, useEffect, useRef, useState } from 'react';

const ENTER_DELAY_MS = 80;
const LEAVE_DELAY_MS = 150;

// Sweeping the pointer across nodes would repaint the graph on every one, so changes are delayed.
export const useDebouncedHover = () => {
  const [hoveredId, setHoveredId] = useState(null);
  const timer = useRef(null);

  const onHover = useCallback((id) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHoveredId(id), id ? ENTER_DELAY_MS : LEAVE_DELAY_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [hoveredId, onHover];
};
