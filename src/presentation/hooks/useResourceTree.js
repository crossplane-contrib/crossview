import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../providers/AppProvider.jsx';

export const useResourceTree = (resource) => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTree = useCallback(async () => {
    if (!resource || !selectedContext) return;

    setLoading(true);
    setError(null);

    try {
      const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
      const params = new URLSearchParams({
        apiVersion: resource.apiVersion,
        kind: resource.kind,
        name: resource.name,
        context: contextName,
      });
      if (resource.namespace) {
        params.set('namespace', resource.namespace);
      }

      const response = await fetch(`/api/resource/tree?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch resource tree');
      }
      const data = await response.json();
      setTree(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resource, selectedContext, kubernetesRepository]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return { tree, loading, error };
};
