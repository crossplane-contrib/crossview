// How many nodes the page draws. On a fast laptop 4,000 appear in under a second and 15,000 in 3 s,
// a slower machine takes several times longer, and 100,000 once crashed the tab.
export const SLOW_ABOVE = 5000;
export const BLOCKED_ABOVE = 10000;

export const BUDGET = Object.freeze({ OK: 'ok', SLOW: 'slow', BLOCKED: 'blocked' });

export const getRenderBudget = (nodeCount) => {
  if (nodeCount > BLOCKED_ABOVE) return { status: BUDGET.BLOCKED, count: nodeCount };
  if (nodeCount > SLOW_ABOVE) return { status: BUDGET.SLOW, count: nodeCount };
  return { status: BUDGET.OK, count: nodeCount };
};
