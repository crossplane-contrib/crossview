import { useEffect, useState } from 'react';
import {
  DASHBOARD_LAYOUT_KEY, defaultDashboardLayout, normalizeDashboardLayout,
  moveDashboardPanel, reorderDashboardPanel, toggleDashboardPanel, resizeDashboardPanel,
} from '../utils/dashboardLayout.js';

export const useDashboardLayout = () => {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
      return { layout: saved ? normalizeDashboardLayout(JSON.parse(saved)) : defaultDashboardLayout(), error: null };
    } catch (error) {
      console.warn('Failed to restore dashboard layout:', error);
      return { layout: defaultDashboardLayout(), error: 'Your saved dashboard layout could not be restored. Default panels are shown.' };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(state.layout));
    } catch (error) {
      console.warn('Failed to save dashboard layout:', error);
      setState(previous => ({
        ...previous, error: 'Your browser could not save the dashboard layout. Changes will last only for this visit.',
      }));
    }
  }, [state.layout]);

  const update = (transform) => setState(previous => ({ ...previous, layout: transform(previous.layout) }));
  return {
    ...state,
    toggle: id => update(layout => toggleDashboardPanel(layout, id)),
    move: (id, direction) => update(layout => moveDashboardPanel(layout, id, direction)),
    reorder: (source, target) => update(layout => reorderDashboardPanel(layout, source, target)),
    resize: (id, size) => update(layout => resizeDashboardPanel(layout, id, size)),
    reset: () => setState({ layout: defaultDashboardLayout(), error: null }),
  };
};
