export const DASHBOARD_LAYOUT_KEY = 'crossview.enterprise.dashboard.layout';
export const DASHBOARD_PANELS = [
  { id: 'metrics', label: 'Overview metrics', span: 12 },
  { id: 'readiness', label: 'Resource readiness', span: 6 },
  { id: 'creation', label: 'Resource creation', span: 6 },
  { id: 'attention', label: 'Needs attention', span: 6 },
  { id: 'namespaces', label: 'Namespace distribution', span: 6 },
  { id: 'packages', label: 'Package health', span: 6 },
  { id: 'compositions', label: 'Composition usage', span: 6 },
  { id: 'recent', label: 'Recently created', span: 6 },
];

export const defaultDashboardLayout = () => ({
  version: 1,
  order: DASHBOARD_PANELS.map(panel => panel.id),
  hidden: [],
  sizes: {},
});

export const normalizeDashboardLayout = (value) => {
  if (!value || value.version !== 1 || !Array.isArray(value.order) || !Array.isArray(value.hidden)
    || !value.order.every(id => typeof id === 'string') || !value.hidden.every(id => typeof id === 'string')) {
    throw new Error('Invalid saved dashboard layout');
  }
  const ids = DASHBOARD_PANELS.map(panel => panel.id);
  const sizes = {};
  if (value.sizes !== undefined) {
    if (!value.sizes || typeof value.sizes !== 'object' || Array.isArray(value.sizes)) {
      throw new Error('Invalid saved dashboard panel sizes');
    }
    for (const id of ids) {
      const size = value.sizes[id];
      if (size === undefined) continue;
      if (!size || ![3, 6, 9, 12].includes(size.span)
        || (size.height !== undefined && (!Number.isFinite(size.height) || size.height < 260 || size.height > 1600))) {
        throw new Error(`Invalid saved size for dashboard panel ${id}`);
      }
      sizes[id] = { span: size.span, ...(size.height === undefined ? {} : { height: size.height }) };
    }
  }
  return {
    version: 1,
    order: [...new Set([...value.order.filter(id => ids.includes(id)), ...ids])],
    hidden: [...new Set(value.hidden.filter(id => ids.includes(id)))],
    sizes,
  };
};

export const reorderDashboardPanel = (layout, source, target) => {
  if (target === 'end' || target.startsWith('before:')) {
    const before = target === 'end' ? null : target.slice(7);
    if (!layout.order.includes(source) || (before && !layout.order.includes(before))) return layout;
    if (source === before) return layout;
    const order = layout.order.filter(id => id !== source);
    order.splice(before ? order.indexOf(before) : order.length, 0, source);
    return { ...layout, order };
  }
  if (source === target || !layout.order.includes(source) || !layout.order.includes(target)) return layout;
  const order = layout.order.filter(id => id !== source);
  order.splice(layout.order.indexOf(target), 0, source);
  return { ...layout, order };
};

export const dashboardGridSlots = (layout) => {
  const visible = layout.order.filter(id => !layout.hidden.includes(id));
  const slots = [];
  let used = 0;
  let previous = null;
  for (const id of visible) {
    const span = layout.sizes[id]?.span || DASHBOARD_PANELS.find(panel => panel.id === id).span;
    if (used + span > 12) {
      slots.push({ target: `before:${id}`, span: 12 - used, previous });
      used = 0;
    }
    slots.push({ id, span });
    used = (used + span) % 12;
    previous = id;
  }
  if (used) slots.push({ target: 'end', span: 12 - used, previous });
  return slots;
};

export const resizeDashboardPanel = (layout, id, size) => {
  if (!layout.order.includes(id) || ![3, 6, 9, 12].includes(size.span)) {
    throw new Error('Invalid dashboard panel width');
  }
  if (size.height !== undefined && (!Number.isFinite(size.height) || size.height < 260 || size.height > 1600)) {
    throw new Error('Invalid dashboard panel height');
  }
  return { ...layout, sizes: { ...layout.sizes, [id]: size } };
};

export const moveDashboardPanel = (layout, id, direction) => {
  const visible = layout.order.filter(panel => !layout.hidden.includes(panel));
  const neighbor = visible[visible.indexOf(id) + direction];
  if (!neighbor || !visible.includes(id)) return layout;
  const order = [...layout.order];
  const source = order.indexOf(id);
  const target = order.indexOf(neighbor);
  [order[source], order[target]] = [order[target], order[source]];
  return { ...layout, order };
};

export const toggleDashboardPanel = (layout, id) => {
  if (!layout.order.includes(id)) return layout;
  return {
    ...layout,
    hidden: layout.hidden.includes(id) ? layout.hidden.filter(panel => panel !== id) : [...layout.hidden, id],
  };
};
