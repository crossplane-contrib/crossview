const COLLECTIONS = [
  ['xrds', 'apiextensions.crossplane.io/v1', 'CompositeResourceDefinition'],
  ['compositions', 'apiextensions.crossplane.io/v1', 'Composition'],
  ['providers', 'pkg.crossplane.io/v1', 'Provider'],
  ['functions', 'pkg.crossplane.io/v1', 'Function'],
];

const normalizeResource = (resource, kind, apiVersion, plural) => ({
  name: resource.metadata?.name || 'unknown',
  namespace: resource.metadata?.namespace || null,
  uid: resource.metadata?.uid || '',
  kind: resource.kind || kind,
  apiVersion: resource.apiVersion || apiVersion,
  plural,
  creationTimestamp: resource.metadata?.creationTimestamp || '',
  conditions: resource.status?.conditions || [],
  spec: resource.spec || {},
});

export class GetDashboardOverviewUseCase {
  constructor(kubernetesRepository) {
    this.kubernetesRepository = kubernetesRepository;
  }

  async list(context, apiVersion, kind, plural) {
    const items = [];
    const tokens = new Set();
    let token = null;
    do {
      const result = await this.kubernetesRepository.getResources(
        apiVersion, kind, null, context, 500, token, plural,
      );
      const page = Array.isArray(result) ? result : result.items;
      if (!Array.isArray(page)) throw new Error(`Invalid ${kind} response`);
      items.push(...page.map(resource => normalizeResource(resource, kind, apiVersion, plural)));
      token = result.continueToken || null;
      if (token && tokens.has(token)) throw new Error(`Repeated pagination token for ${kind}`);
      if (token) tokens.add(token);
    } while (token);
    return items;
  }

  async listManaged(context) {
    const items = [];
    const tokens = new Set();
    let token = null;
    let fromCache = false;
    do {
      const result = await this.kubernetesRepository.getManagedResources(
        context, false, { limit: 500, continueToken: token },
      );
      if (!Array.isArray(result.items)) throw new Error('Invalid managed resources response');
      items.push(...result.items.map(resource => normalizeResource(resource)));
      fromCache ||= result.fromCache;
      token = result.continueToken || null;
      if (token && tokens.has(token)) throw new Error('Repeated managed resources pagination token');
      if (token) tokens.add(token);
      if (!token && result.totalCount > items.length) {
        throw new Error(`Managed resource list is incomplete (${items.length} of ${result.totalCount})`);
      }
    } while (token);
    return { items, fromCache };
  }

  async execute(context) {
    const data = {};
    const errors = [];
    const capture = async (key, load) => {
      try {
        data[key] = await load();
      } catch (error) {
        data[key] = null;
        errors.push({ source: key, message: error.message });
      }
    };

    const loadDefinedResources = async (key, namesKey) => {
      if (data.xrds === null) {
        data[key] = null;
        return;
      }
      const definitions = new Map();
      for (const xrd of data.xrds) {
        const names = xrd.spec[namesKey];
        if (!names?.kind) continue;
        const version = xrd.spec.versions?.find(entry => entry.referenceable)
          || xrd.spec.versions?.find(entry => entry.served)
          || xrd.spec.versions?.[0];
        if (!xrd.spec.group || !version?.name) {
          errors.push({ source: key, message: `Invalid resource definition: ${xrd.name}` });
          continue;
        }
        const apiVersion = `${xrd.spec.group}/${version.name}`;
        definitions.set(`${apiVersion}/${names.kind}`, { apiVersion, ...names });
      }
      const results = await Promise.allSettled([...definitions.values()].map(
        ({ apiVersion, kind, plural }) => this.list(context, apiVersion, kind, plural),
      ));
      data[key] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') data[key].push(...result.value);
        else errors.push({
          source: key,
          message: `${[...definitions.values()][index].kind}: ${result.reason.message}`,
        });
      });
    };

    const collectionLoads = new Map(COLLECTIONS.map(([key, apiVersion, kind]) =>
      [key, capture(key, () => this.list(context, apiVersion, kind))]));
    await Promise.all([
      ...collectionLoads.values(),
      capture('managed', () => this.listManaged(context)),
      collectionLoads.get('xrds').then(() => Promise.all([
        loadDefinedResources('compositeResources', 'names'),
        loadDefinedResources('claims', 'claimNames'),
      ])),
    ]);

    return {
      ...data,
      managedResources: data.managed?.items ?? null,
      managedFromCache: data.managed?.fromCache || false,
      errors,
      updatedAt: new Date().toISOString(),
    };
  }
}
