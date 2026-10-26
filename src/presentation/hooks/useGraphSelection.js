import { useState } from 'react';

const toDetailResource = (node) => ({
  apiVersion: node.apiVersion,
  kind: node.kind,
  name: node.name,
  namespace: node.namespace || null,
  plural: node.plural,
});

// The selected node and the details panel under the graph, with its back history.
export const useGraphSelection = () => {
  const [selectedId, setSelectedId] = useState(null);
  const [detailResource, setDetailResource] = useState(null);
  const [history, setHistory] = useState([]);

  const clear = () => {
    setSelectedId(null);
    setDetailResource(null);
    setHistory([]);
  };

  const toggleNode = (node) => {
    if (node.id === selectedId) {
      clear();
      return;
    }
    setSelectedId(node.id);
    setHistory([]);
    setDetailResource(toDetailResource(node));
  };

  const openRelated = (resource) => {
    setHistory((previous) => [...previous, detailResource]);
    setDetailResource(resource);
  };

  const goBack = () => {
    setDetailResource(history.at(-1));
    setHistory((previous) => previous.slice(0, -1));
  };

  return { selectedId, detailResource, canGoBack: history.length > 0, toggleNode, openRelated, goBack, clear };
};
