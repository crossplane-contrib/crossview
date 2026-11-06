import { useCallback, useEffect, useState } from 'react';
import { GetDashboardOverviewUseCase } from '../../domain/usecases/GetDashboardOverviewUseCase.js';

export const useDashboardOverview = (kubernetesRepository, selectedContext) => {
  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ contextName: null, data: null, loading: false, error: null });
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let active = true;
    if (!contextName) return;
    setState({ contextName, data: null, loading: true, error: null });
    const load = async () => {
      try {
        const data = await new GetDashboardOverviewUseCase(kubernetesRepository).execute(contextName);
        if (active) setState({ contextName, data, loading: false, error: null });
      } catch (error) {
        if (active) setState({ contextName, data: null, loading: false, error: error.message });
      }
    };
    load();
    return () => { active = false; };
  }, [contextName, kubernetesRepository, revision]);

  if (!contextName || state.contextName !== contextName) {
    return { data: null, loading: Boolean(contextName), error: null, refresh };
  }
  return { ...state, refresh };
};
