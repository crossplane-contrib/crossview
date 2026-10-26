import { NODE_TYPES, NODE_TYPE } from './graphModel.js';
import { DEFAULT_LIMITS, MAX_LIMIT } from './graphLimits.js';

export const DEFAULT_GRAPH_FILTERS = {
  types: NODE_TYPES,
  namespace: '',
  kind: '',
  search: '',
  health: '',
  focus: '',
  limits: DEFAULT_LIMITS,
};

// Each text filter and its URL parameter, so parsing and writing cannot drift apart.
const TEXT_PARAMS = { namespace: 'ns', kind: 'kind', search: 'q', focus: 'focus' };

export const HEALTH_FILTERS = ['healthy', 'unhealthy'];

const LIMIT_PARAMS = {
  [NODE_TYPE.XRD]: 'maxXrd',
  [NODE_TYPE.COMPOSITION]: 'maxComposition',
  [NODE_TYPE.FUNCTION]: 'maxFunction',
  [NODE_TYPE.XR]: 'maxXr',
  [NODE_TYPE.COMPOSED]: 'maxComposed',
};

const parseLimit = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_LIMIT) : fallback;
};

export const parseGraphFilters = (params) => {
  const filters = { ...DEFAULT_GRAPH_FILTERS };
  Object.entries(TEXT_PARAMS).forEach(([key, param]) => {
    filters[key] = params.get(param) || '';
  });
  filters.health = HEALTH_FILTERS.includes(params.get('health')) ? params.get('health') : '';
  filters.limits = Object.fromEntries(
    Object.entries(LIMIT_PARAMS).map(([type, param]) => [type, parseLimit(params.get(param), DEFAULT_LIMITS[type])])
  );
  const types = params.get('types');
  if (types) filters.types = types.split(',').filter((t) => NODE_TYPES.includes(t));
  return filters;
};

// Only non-default values are written, so a plain /graph URL stays clean.
export const serializeGraphFilters = (filters) => {
  const params = new URLSearchParams();
  Object.entries(TEXT_PARAMS).forEach(([key, param]) => {
    if (filters[key]) params.set(param, filters[key]);
  });
  if (filters.health) params.set('health', filters.health);
  Object.entries(LIMIT_PARAMS).forEach(([type, param]) => {
    if (filters.limits[type] !== DEFAULT_LIMITS[type]) params.set(param, String(filters.limits[type]));
  });
  if (filters.types.length !== NODE_TYPES.length) params.set('types', filters.types.join(','));
  return params;
};

export const hasActiveFilters = (filters) => serializeGraphFilters(filters).toString() !== '';
