import { useCallback, useMemo, useState } from 'react';
import { GetGraphUseCase } from '../../domain/usecases/GetGraphUseCase.js';
import { withoutComposedStubs } from '../utils/graph/graphHealth.js';
import { useCachedSnapshot } from './useCachedSnapshot.js';
import { readSnapshot } from '../utils/snapshotCache.js';

const EMPTY_GRAPH = { nodes: [], edges: [], warnings: [] };

// Loads the graph without the slow managed resource list, so it appears sooner. Once health is
// wanted the graph is loaded again with it, and keeps it for the rest of the visit.
export const useGraphData = (kubernetesRepository, selectedContext, wantHealth) => {
  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name;
  const [healthContext, setHealthContext] = useState(null);
  if (wantHealth && contextName && healthContext !== contextName) setHealthContext(contextName);
  const healthKey = `graph:health:${contextName}`;
  const includeHealth = wantHealth || healthContext === contextName || Boolean(readSnapshot(kubernetesRepository, healthKey));
  const key = contextName ? (includeHealth ? healthKey : `graph:structure:${contextName}`) : null;
  const load = useCallback(async () => ({
    graph: await new GetGraphUseCase(kubernetesRepository).execute(contextName, { includeManaged: includeHealth }),
    healthLoaded: includeHealth,
  }), [kubernetesRepository, contextName, includeHealth]);
  const snapshot = useCachedSnapshot(kubernetesRepository, key, load);
  const fallback = contextName ? readSnapshot(kubernetesRepository, `graph:structure:${contextName}`) : null;
  const data = snapshot.data || fallback;
  const healthLoaded = data?.healthLoaded || false;
  const raw = data?.graph || EMPTY_GRAPH;
  const graph = useMemo(() => withoutComposedStubs(raw, healthLoaded), [raw, healthLoaded]);
  return { ...snapshot, graph, healthLoaded, loading: snapshot.loading && !data,
    refreshing: snapshot.refreshing || (snapshot.loading && Boolean(data)) };
};
