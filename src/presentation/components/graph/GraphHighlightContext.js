import { createContext, useContext, useSyncExternalStore } from 'react';

// Holds which nodes are highlighted outside React state. Each node and edge reads only its own
// answer, so a change re-renders the few that joined or left the chain, not everything in view.
export const createHighlightStore = () => {
  let state = { lineage: null, selectedId: null };
  const listeners = new Set();
  return {
    getState: () => state,
    set(next) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const GraphHighlightContext = createContext(createHighlightStore());

const useHighlightValue = (select) => {
  const store = useContext(GraphHighlightContext);
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
};

export const useIsInLineage = (...ids) =>
  useHighlightValue(({ lineage }) => Boolean(lineage) && ids.every((id) => lineage.has(id)));

export const useIsSelected = (id) => useHighlightValue(({ selectedId }) => selectedId === id);
