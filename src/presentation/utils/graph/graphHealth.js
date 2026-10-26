import { NODE_TYPE } from './graphModel.js';

// Set by the API when the managed resource list was left out on purpose.
const MANAGED_SKIPPED = 'managed-skipped';

// A Composed Resource missing from the managed list is usually a plain object, such as a Deployment, so it is no warning.
// Without health loaded the page already says so, which makes the skipped warning redundant.
export const withoutComposedStubs = (graph, healthLoaded) => ({
  ...graph,
  nodes: graph.nodes.map((node) => (node.type === NODE_TYPE.COMPOSED && node.unresolved ? { ...node, unresolved: false } : node)),
  warnings: healthLoaded ? graph.warnings : graph.warnings.filter((warning) => warning.code !== MANAGED_SKIPPED),
});
