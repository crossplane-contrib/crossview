import { NODE_TYPE, NODE_TYPES, getKindKey, isUnhealthy } from './graphModel.js';
import { keepOnly } from './graphFilters.js';

// What a slider can be set to. Past a couple of hundred nodes a column is too tall to read in one go.
export const LIMIT_STEPS = [0, 5, 10, 20, 50, 100, 250, 500, 1000, 2000, 5000];
export const MAX_LIMIT = LIMIT_STEPS[LIMIT_STEPS.length - 1];

// Few enough to read and click at a glance; a slider raises any of them. Composed is three per XR.
export const DEFAULT_LIMITS = Object.freeze({
  [NODE_TYPE.XRD]: 25,
  [NODE_TYPE.COMPOSITION]: 25,
  [NODE_TYPE.FUNCTION]: 25,
  [NODE_TYPE.XR]: 15,
  [NODE_TYPE.COMPOSED]: 45,
});

const SINGULAR = { [NODE_TYPE.XR]: 'Composite Resource', [NODE_TYPE.COMPOSED]: 'Composed Resource' };

const byNamespaceThenName = (a, b) => (a.namespace || '').localeCompare(b.namespace || '') || a.name.localeCompare(b.name);

const ofType = (nodes, type) => nodes.filter((n) => n.type === type);

const unhealthyFirst = (nodes) => [...nodes.filter(isUnhealthy), ...nodes.filter((n) => !isUnhealthy(n))];

// Takes one of each kind in turn, so every definition keeps some instances on screen.
const spreadAcrossKinds = (nodes) => {
  const byKind = new Map();
  [...nodes].sort(byNamespaceThenName).forEach((node) => {
    const kind = getKindKey(node);
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(node);
  });
  const lists = [...byKind.values()];
  const spread = [];
  for (let round = 0; spread.length < nodes.length; round += 1) {
    lists.forEach((list) => {
      if (round < list.length) spread.push(list[round]);
    });
  }
  return spread;
};

// Unhealthy ones first, since those are what people come looking for.
const chooseXRs = (xrs, limit) => {
  const [unhealthy, healthy] = [xrs.filter(isUnhealthy), xrs.filter((n) => !isUnhealthy(n))];
  return [...spreadAcrossKinds(unhealthy), ...spreadAcrossKinds(healthy)].slice(0, limit);
};

// The Composed Resources of the XRs on screen, one XR's at a time so each chain stays whole.
const chooseComposed = (composed, chosenXRs, limit, summary, anyXRMatched) => {
  if (!anyXRMatched) return unhealthyFirst([...composed].sort(byNamespaceThenName)).slice(0, limit);
  const matchedById = new Map(composed.map((n) => [n.id, n]));
  const children = new Set();
  chosenXRs.forEach((xr) => (summary.composedChildren.get(xr.id) || []).forEach((id) => matchedById.has(id) && children.add(matchedById.get(id))));
  return unhealthyFirst([...children]).slice(0, limit);
};

// Definitions linked to what is on screen come first, then unhealthy ones, then by name.
const chooseDefinitions = (definitions, limit, linkedIds) => {
  const rank = (n) => (linkedIds.has(n.id) ? 0 : 2) + (isUnhealthy(n) ? 0 : 1);
  return [...definitions].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, limit);
};

const countBy = (items, keyOf) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
};

// For each node that has instances or children, how many are on screen out of how many matched.
const buildPartialCounts = ({ matchedXRs, chosenXRs, matchedComposed, chosenComposed, summary }) => {
  const parentsOf = (xr) => [summary.xrdByDefines.get(getKindKey(xr)), summary.compositionOf.get(xr.id)];
  const xrTotals = countBy(matchedXRs.flatMap(parentsOf), (id) => id);
  const xrShown = countBy(chosenXRs.flatMap(parentsOf), (id) => id);

  const chosenIds = new Set(chosenComposed.map((n) => n.id));
  const composedTotals = new Map();
  const composedShown = new Map();
  matchedComposed.forEach((child) => {
    (summary.composedParents.get(child.id) || []).forEach((xrId) => {
      composedTotals.set(xrId, (composedTotals.get(xrId) || 0) + 1);
      if (chosenIds.has(child.id)) composedShown.set(xrId, (composedShown.get(xrId) || 0) + 1);
    });
  });

  const partial = new Map();
  const record = (totals, shown, label) =>
    totals.forEach((total, id) => {
      if ((shown.get(id) || 0) < total) partial.set(id, { shown: shown.get(id) || 0, total, label });
    });
  record(xrTotals, xrShown, SINGULAR[NODE_TYPE.XR]);
  record(composedTotals, composedShown, SINGULAR[NODE_TYPE.COMPOSED]);
  return partial;
};

// Keeps at most limits[type] nodes of each type from what the filters matched. Which ones: the
// unhealthy first, then an even spread across kinds, with each shown XR's Composed Resources.
export const applyLimits = (matched, limits, summary) => {
  const byType = Object.fromEntries(NODE_TYPES.map((type) => [type, ofType(matched.nodes, type)]));
  const matchedXRs = byType[NODE_TYPE.XR];

  const chosenXRs = chooseXRs(matchedXRs, limits[NODE_TYPE.XR]);
  const chosenComposed = chooseComposed(byType[NODE_TYPE.COMPOSED], chosenXRs, limits[NODE_TYPE.COMPOSED], summary, matchedXRs.length > 0);

  const linkedXRDs = new Set(chosenXRs.map((xr) => summary.xrdByDefines.get(getKindKey(xr))));
  const linkedCompositions = new Set(chosenXRs.map((xr) => summary.compositionOf.get(xr.id)));
  const chosenXRDs = chooseDefinitions(byType[NODE_TYPE.XRD], limits[NODE_TYPE.XRD], linkedXRDs);
  const chosenCompositions = chooseDefinitions(byType[NODE_TYPE.COMPOSITION], limits[NODE_TYPE.COMPOSITION], linkedCompositions);

  const compositionIds = new Set(chosenCompositions.map((c) => c.id));
  const linkedFunctions = new Set(matched.edges.filter((e) => compositionIds.has(e.source)).map((e) => e.target));
  const chosenFunctions = chooseDefinitions(byType[NODE_TYPE.FUNCTION], limits[NODE_TYPE.FUNCTION], linkedFunctions);

  const chosen = {
    [NODE_TYPE.XRD]: chosenXRDs,
    [NODE_TYPE.COMPOSITION]: chosenCompositions,
    [NODE_TYPE.FUNCTION]: chosenFunctions,
    [NODE_TYPE.XR]: chosenXRs,
    [NODE_TYPE.COMPOSED]: chosenComposed,
  };
  const keepIds = new Set(Object.values(chosen).flat().map((n) => n.id));
  const shown = Object.fromEntries(NODE_TYPES.map((type) => [type, chosen[type].length]));
  const matchedCounts = Object.fromEntries(NODE_TYPES.map((type) => [type, byType[type].length]));

  return {
    view: keepOnly(matched, (n) => keepIds.has(n.id)),
    shown,
    matchedCounts,
    limited: NODE_TYPES.some((type) => shown[type] < matchedCounts[type]),
    partial: buildPartialCounts({ matchedXRs, chosenXRs, matchedComposed: byType[NODE_TYPE.COMPOSED], chosenComposed, summary }),
  };
};

// The values a slider offers for a type with this many matches, always including the current one.
export const stepsFor = (matchedCount, current) => {
  const steps = LIMIT_STEPS.filter((step) => step <= matchedCount);
  const next = LIMIT_STEPS.find((step) => step >= matchedCount);
  return [...new Set([...steps, ...(next === undefined ? [] : [next]), current])].sort((a, b) => a - b);
};

// The index a plus or minus button moves to, never past either end of the list.
export const stepIndexAfter = (index, delta, stepCount) => Math.min(Math.max(index + delta, 0), stepCount - 1);
