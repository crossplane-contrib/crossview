import { useEffect, useMemo, useRef, useState } from 'react';
import { GetGraphUseCase } from '../../domain/usecases/GetGraphUseCase.js';
import { withoutComposedStubs } from '../utils/graph/graphHealth.js';

const EMPTY_GRAPH = { nodes: [], edges: [], warnings: [] };

const contextNameOf = (context) => (typeof context === 'string' ? context : context.name || context);

// Loads the graph without the slow managed resource list, so it appears sooner. Once health is
// wanted the graph is loaded again with it, and keeps it for the rest of the visit.
export const useGraphData = (kubernetesRepository, selectedContext, wantHealth) => {
  const [raw, setRaw] = useState(EMPTY_GRAPH);
  const [healthLoaded, setHealthLoaded] = useState(false);
  const [everWanted, setEverWanted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loadedContext = useRef(null);
  const includeHealth = everWanted || wantHealth;

  useEffect(() => {
    if (wantHealth) setEverWanted(true);
  }, [wantHealth]);

  useEffect(() => {
    if (!selectedContext) {
      setLoading(false);
      return undefined;
    }
    const contextName = contextNameOf(selectedContext);
    let cancelled = false;
    const load = async () => {
      // Loading again for the same context keeps the graph on screen; a new context starts over.
      const startOver = loadedContext.current !== contextName;
      try {
        setLoading(startOver);
        setRefreshing(!startOver);
        setError(null);
        const data = await new GetGraphUseCase(kubernetesRepository).execute(contextName, { includeManaged: includeHealth });
        if (cancelled) return;
        setRaw(data);
        setHealthLoaded(includeHealth);
        loadedContext.current = contextName;
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedContext, kubernetesRepository, includeHealth]);

  const graph = useMemo(() => withoutComposedStubs(raw, healthLoaded), [raw, healthLoaded]);

  return { graph, healthLoaded, loading, refreshing, error };
};
