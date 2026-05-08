import { useEffect, useRef, useCallback } from 'react';

export const useContextData = (dependencies = []) => {
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const executeWithAbort = useCallback(async (asyncFn) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const result = await asyncFn(signal);
      if (!signal.aborted && isMountedRef.current) {
        return result;
      }
      return null;
    } catch (err) {
      if (signal.aborted) {
        return null;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, dependencies);

  return { executeWithAbort, isMounted: isMountedRef };
};
