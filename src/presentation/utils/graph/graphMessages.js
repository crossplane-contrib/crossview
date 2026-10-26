import { NODE_TYPE, NODE_TYPES, formatCount, noun, pluralize } from './graphModel.js';
import { BUDGET, BLOCKED_ABOVE } from './graphBudget.js';

const COMPOSITE = 'Composite Resource';
const COMPOSED = 'Composed Resource';

const SINGULAR = {
  [NODE_TYPE.XRD]: 'XRD',
  [NODE_TYPE.COMPOSITION]: 'Composition',
  [NODE_TYPE.FUNCTION]: 'Function',
  [NODE_TYPE.XR]: COMPOSITE,
  [NODE_TYPE.COMPOSED]: COMPOSED,
};

// "all 2,500" when nothing is left out, otherwise "1,200 of 2,500".
const shownOfTotal = (shown, total) => (shown === total ? `all ${formatCount(total)}` : `${formatCount(shown)} of ${formatCount(total)}`);

const joinWithAnd = (parts) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

const describePhrases = (result, limited) => {
  const { shown, matchedCounts } = result;
  const types = limited
    ? NODE_TYPES.filter((type) => shown[type] < matchedCounts[type])
    : [NODE_TYPE.XR, NODE_TYPE.COMPOSED].filter((type) => matchedCounts[type] > 0);
  return joinWithAnd(types.map((type) => `${shownOfTotal(shown[type], matchedCounts[type])} ${noun(matchedCounts[type], SINGULAR[type])}`));
};

// One sentence saying what is on screen, in the names used everywhere else in Crossview.
export const describeView = ({ summary, result }) => {
  if (summary.byType[NODE_TYPE.XR].count === 0 && summary.byType[NODE_TYPE.COMPOSED].count === 0) {
    return 'Showing XRDs, Compositions and Functions. There are no Composite Resources yet.';
  }
  if (NODE_TYPES.every((type) => result.matchedCounts[type] === 0)) return 'No resources match the current filters.';
  return `Showing ${describePhrases(result, result.limited)}.`;
};

export const describeBlocked = (budget) =>
  `Not drawn: ${formatCount(budget.count)} nodes is over the limit of ${formatCount(BLOCKED_ABOVE)}. Open this to lower a limit.`;

// The line shown while the panel is closed. A limited view says so up front, as a warning.
export const describeHeadline = ({ summary, result, budget }) => {
  if (budget.status === BUDGET.BLOCKED) return { text: describeBlocked(budget), warn: true };
  return result.limited
    ? { text: `Not everything is shown: ${describePhrases(result, true)}.`, warn: true }
    : { text: describeView({ summary, result }), warn: false };
};

// Small counts beside the headline, so the closed panel still says what needs a look.
export const summarizeAlerts = (summary, notices) =>
  [
    summary.unhealthyTotal > 0 && `${formatCount(summary.unhealthyTotal)} need attention`,
    notices.length > 0 && pluralize(notices.length, 'notice'),
  ].filter(Boolean);

export const describeLimitHint = () =>
  'Unhealthy ones first, then an even spread across kinds. Raise a slider or filter for more.';

// The line about resources that are not healthy, or null when everything is.
export const describeAttention = (summary, alreadyFiltered) => {
  if (summary.unhealthyTotal === 0) return null;
  const parts = [[NODE_TYPE.XR, COMPOSITE], [NODE_TYPE.COMPOSED, COMPOSED]]
    .filter(([type]) => summary.byType[type].unhealthy > 0)
    .map(([type, name]) => pluralize(summary.byType[type].unhealthy, name));
  const detail = parts.length ? `: ${parts.join(', ')}` : '';
  return { text: `${formatCount(summary.unhealthyTotal)} need attention${detail}.`, active: alreadyFiltered };
};

const SEVERITY = { WARNING: 'warning', INFO: 'info' };

// Everything the page wants to tell the user about the graph itself, as one list.
export const buildNotices = ({ summary, backendWarnings, budget }) => {
  const notices = backendWarnings.map((w) => ({ id: w.code + w.message, severity: SEVERITY.WARNING, message: w.message }));

  if (budget.status === BUDGET.BLOCKED) {
    notices.push({
      id: 'over-budget',
      severity: SEVERITY.WARNING,
      message: `That would draw ${formatCount(budget.count)} nodes. The page does not draw more than ${formatCount(BLOCKED_ABOVE)}, because it gets slow and can run out of memory.`,
    });
  } else if (budget.status === BUDGET.SLOW) {
    notices.push({
      id: 'slow',
      severity: SEVERITY.WARNING,
      message: `Drawing ${formatCount(budget.count)} nodes can take a few seconds to appear and use a lot of memory.`,
    });
  }

  const unresolved = summary.unresolved;
  if (unresolved > 0) {
    const subject = unresolved === 1 ? '1 resource is referenced but its status is unknown, so it has' : `${formatCount(unresolved)} resources are referenced but their status is unknown, so they have`;
    notices.push({ id: 'unresolved', severity: SEVERITY.WARNING, message: `${subject} a dashed yellow border. It may be missing or not managed by Crossplane.` });
  }

  const orphans = summary.withoutComposition.size;
  if (orphans > 0) {
    const message = orphans === 1
      ? '1 Composite Resource has no Composition. Check its Synced condition.'
      : `${formatCount(orphans)} Composite Resources have no Composition. Check their Synced condition.`;
    notices.push({ id: 'without-composition', severity: SEVERITY.WARNING, message });
  }

  return notices;
};
