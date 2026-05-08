export class GetManagedResourceActivationPoliciesUseCase {
  constructor(kubernetesRepository) {
    this.kubernetesRepository = kubernetesRepository;
  }

  async execute(context = null) {
    try {
      const managedResourcesResult = await this.kubernetesRepository.getManagedResources(context);
      const allResources = managedResourcesResult.items || [];
      
      const mraps = allResources.filter(item => item.kind === 'ManagedResourceActivationPolicy');
      const mrapsArray = Array.isArray(mraps) ? mraps : [];
      
      return mrapsArray.map(mrap => ({
        name: mrap.metadata?.name || 'unknown',
        namespace: mrap.metadata?.namespace || null,
        uid: mrap.metadata?.uid || '',
        creationTimestamp: mrap.metadata?.creationTimestamp || '',
        labels: mrap.metadata?.labels || {},
        activationPolicy: mrap.spec?.activationPolicy || '',
        managedResourceSelector: mrap.spec?.managedResourceSelector || {},
        spec: mrap.spec || {},
        status: mrap.status || {},
        conditions: mrap.status?.conditions || [],
      }));
    } catch (error) {
      throw new Error(`Failed to get managed resource activation policies: ${error.message}`);
    }
  }
}