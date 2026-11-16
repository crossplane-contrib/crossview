import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSnapshot, readSnapshot } from '../utils/snapshotCache.js';

export const useCachedSnapshot = (repository, key, load) => {
  const [state, setState] = useState({ repository: null, key: null, data: null, pending: false, error: null });
  const [revision, setRevision] = useState(0);
  const forceKey = useRef(null);
  const refresh = useCallback(() => {
    forceKey.current = key;
    setState(previous => ({ ...previous, pending: true, error: null }));
    setRevision(value => value + 1);
  }, [key]);

  useEffect(() => {
    let active = true;
    if (!key) return;
    const cached = readSnapshot(repository, key);
    const force = forceKey.current === key;
    forceKey.current = null;
    setState({ repository, key, data: cached || null, pending: true, error: null });
    loadSnapshot(repository, key, load, force).then(
      data => { if (active) setState({ repository, key, data, pending: false, error: null }); },
      error => {
        if (active) setState({ repository, key, data: cached || null, pending: false, error: error.message });
      },
    );
    return () => { active = false; };
  }, [repository, key, load, revision]);

  const current = state.repository === repository && state.key === key;
  const data = key ? (current ? state.data : readSnapshot(repository, key)) : null;
  const pending = Boolean(key) && (!current || state.pending);
  return {
    data: data || null,
    loading: pending && !data,
    refreshing: pending && Boolean(data),
    error: current && key ? state.error : null,
    refresh,
  };
};
