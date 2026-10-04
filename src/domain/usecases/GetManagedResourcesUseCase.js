export class GetManagedResourcesUseCase {
  constructor(kubernetesRepository) {
    this.kubernetesRepository = kubernetesRepository;
  }

  async execute(context = null, namespace = null, forceRefresh = false, options = {}) {
    try {
      const result = await this.kubernetesRepository.getManagedResources(context, forceRefresh, options);
      const resources = result.items || [];
      const fromCache = result.fromCache || false;
      
      let filtered = resources;
      if (namespace) {
        filtered = resources.filter(r => (r.metadata?.namespace || '') === namespace);
      }
      
      const mapped = filtered.map(resource => ({
                name: resource.metadata?.name || 'unknown',
        namespace: resource.metadata?.namespace || null,
                uid: resource.metadata?.uid || '',
        kind: resource.kind || '',
        apiVersion: resource.apiVersion || '',
                creationTimestamp: resource.metadata?.creationTimestamp || '',
                labels: resource.metadata?.labels || {},
                annotations: resource.metadata?.annotations || {},
                externalName: resource.metadata?.annotations?.['crossplane.io/external-name'] || null,
                provider: resource.metadata?.labels?.['crossplane.io/provider'] || null,
                status: resource.status || {},
                conditions: resource.status?.conditions || [],
        spec: resource.spec || {},
      }));
      
      return {
        items: mapped,
        fromCache,
        totalCount: typeof result.totalCount === 'number' ? result.totalCount : mapped.length,
        continueToken: result.continueToken || null
      };
    } catch (error) {
      throw new Error(`Failed to get managed resources: ${error.message}`);
    }
  }
}

