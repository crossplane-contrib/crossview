export const RESOURCE_COLLECTIONS = [
  { key: 'compositeResources', label: 'Composite resources', path: '/composite-resources' },
  { key: 'claims', label: 'Claims', path: '/claims' },
  { key: 'managedResources', label: 'Managed resources', path: '/managed-resources' },
];

export const getReadiness = (resource) => {
  const conditions = resource.conditions || [];
  const packageResource = resource.kind === 'Provider' || resource.kind === 'Function';
  const types = packageResource ? ['Installed', 'Healthy'] : ['Ready', 'Synced'];
  const relevant = conditions.filter(condition => types.includes(condition.type));
  if (relevant.some(condition => condition.status === 'False')) return 'notReady';
  const primary = conditions.find(condition => condition.type === (packageResource ? 'Healthy' : 'Ready'));
  if (primary?.status === 'True' && relevant.every(condition => condition.status === 'True')) {
    if (packageResource && !conditions.some(condition => condition.type === 'Installed' && condition.status === 'True')) {
      return 'unknown';
    }
    return 'ready';
  }
  return 'unknown';
};

export const resourceKey = (resource) =>
  `${resource.apiVersion}/${resource.kind}/${resource.namespace || ''}/${resource.name}`;

export const buildDashboardSummary = (data, days = 14) => {
  const resources = RESOURCE_COLLECTIONS.flatMap(({ key, label }) =>
    (data[key] || []).map(resource => ({ ...resource, category: label })));
  const health = { ready: 0, notReady: 0, unknown: 0 };
  const namespaces = new Map();
  const usage = new Map();
  const end = new Date(data.updatedAt);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const activity = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), compositeResources: 0, claims: 0, managedResources: 0 };
  });
  resources.forEach(resource => {
    const status = getReadiness(resource);
    health[status]++;
    const namespace = resource.namespace || 'Cluster-scoped';
    if (!namespaces.has(namespace)) namespaces.set(namespace, { label: namespace, ready: 0, notReady: 0, unknown: 0, total: 0 });
    namespaces.get(namespace)[status]++;
    namespaces.get(namespace).total++;
  });
  RESOURCE_COLLECTIONS.forEach(({ key }) => {
    (data[key] || []).forEach(resource => {
      const created = Date.parse(resource.creationTimestamp);
      const index = Math.floor((created - start.getTime()) / 86400000);
      if (index >= 0 && index < days) activity[index][key]++;
    });
  });
  (data.compositeResources || []).forEach(resource => {
    const composition = resource.spec.crossplane?.compositionRef?.name || resource.spec.compositionRef?.name;
    if (composition) usage.set(composition, (usage.get(composition) || 0) + 1);
  });
  const attention = resources.filter(resource => getReadiness(resource) === 'notReady')
    .sort((a, b) => resourceKey(a).localeCompare(resourceKey(b)));
  const packages = [...(data.providers || []), ...(data.functions || [])];
  const recent = [...resources].filter(resource => Number.isFinite(Date.parse(resource.creationTimestamp)))
    .sort((a, b) => Date.parse(b.creationTimestamp) - Date.parse(a.creationTimestamp)).slice(0, 8);
  return {
    resources,
    health,
    total: resources.length,
    percentage: resources.length ? Math.round(health.ready / resources.length * 100) : null,
    namespaces: [...namespaces.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    activity,
    attention,
    packages,
    recent,
    compositions: (data.compositions || []).map(composition => ({
      ...composition, count: usage.get(composition.name) || 0,
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
};
