export const NODE_TYPE = Object.freeze({
  XRD: 'xrd',
  COMPOSITION: 'composition',
  XR: 'xr',
  COMPOSED: 'composed',
  FUNCTION: 'function',
});

export const EDGE_TYPE = Object.freeze({
  XRD_COMPOSITION: 'xrdComposition',
  XRD_XR: 'xrdXR',
  COMPOSITION_XR: 'compositionXR',
  COMPOSITION_FUNCTION: 'compositionFunction',
  XR_XR: 'xrXR',
  XR_COMPOSED: 'xrComposed',
});

// The order the types are listed in the filter bar.
export const NODE_TYPES = [
  NODE_TYPE.XRD,
  NODE_TYPE.COMPOSITION,
  NODE_TYPE.XR,
  NODE_TYPE.COMPOSED,
  NODE_TYPE.FUNCTION,
];

export const NODE_TYPE_LABELS = {
  [NODE_TYPE.XRD]: 'XRDs',
  [NODE_TYPE.COMPOSITION]: 'Compositions',
  [NODE_TYPE.XR]: 'Composite Resources',
  [NODE_TYPE.COMPOSED]: 'Composed Resources',
  [NODE_TYPE.FUNCTION]: 'Functions',
};

export const nodeLabel = (node) => `${node.kind}/${node.name}`;

export const getNodeGroup = (node) => {
  const slash = (node.apiVersion || '').indexOf('/');
  return slash >= 0 ? node.apiVersion.slice(0, slash) : '';
};

// Identifies a kind across API versions, for example "platform.example.org/IdentityClient".
export const getKindKey = (node) => `${getNodeGroup(node)}/${node.kind}`;

const PROVIDER_GROUP_SUFFIXES = ['.m.crossplane.io', '.crossplane.io', '.upbound.io'];

// Splits a provider API group into its provider and service, so "iam.aws.upbound.io" is aws and iam.
const providerOf = (node) => {
  const group = getNodeGroup(node);
  const suffix = PROVIDER_GROUP_SUFFIXES.find((s) => group.endsWith(s));
  if (!suffix) return null;
  const labels = group.slice(0, -suffix.length).split('.');
  return { provider: labels[labels.length - 1], service: labels.slice(0, -1).join('.') };
};

// The short title on a node: what it is, led by where it comes from, such as "aws/iam · Role" or "k8s · Deployment".
export const kindTitle = (node) => {
  if (node.type !== NODE_TYPE.COMPOSED) return node.kind;
  const origin = providerOf(node);
  if (!origin) return node.kind;
  if (origin.provider === 'kubernetes') return `k8s · ${node.wraps || node.kind}`;
  const source = origin.service ? `${origin.provider}/${origin.service}` : origin.provider;
  return `${source} · ${node.kind}`;
};

export const isUnhealthy = (node) => node.ready === 'False' || node.synced === 'False';

export const isHealthy = (node) => node.ready === 'True' && !isUnhealthy(node);

export const formatCount = (n) => n.toLocaleString('en-US');

export const noun = (count, singular) => `${singular}${count === 1 ? '' : 's'}`;

// "1 Composed Resource", "3 Composed Resources".
export const pluralize = (count, singular) => `${formatCount(count)} ${noun(count, singular)}`;
