export class GetManagedResourceDefinitionsUseCase {
  constructor(kubernetesRepository) {
    this.kubernetesRepository = kubernetesRepository;
  }

  async execute(context = null) {
    try {
      const managedResourcesResult = await this.kubernetesRepository.getManagedResources(context);
      const allResources = managedResourcesResult.items || [];
      
      const mrds = allResources.filter(item => item.kind === 'ManagedResourceDefinition');
      const mrdsArray = Array.isArray(mrds) ? mrds : [];
      
      return mrdsArray.map(mrd => {
        const conditions = mrd.status?.conditions || [];
        const establishedCondition = conditions.find(c => c.type === 'Established');
        const established = establishedCondition?.status === 'True' ? 'True' : 'False';
        
        const readyCondition = conditions.find(c => c.type === 'Ready');
        const syncedCondition = conditions.find(c => c.type === 'Synced');
        let state = 'Active';
        if (conditions.length > 0 && readyCondition?.status !== 'True' && syncedCondition?.status !== 'True' && establishedCondition?.status !== 'True') {
          state = 'Inactive';
        }
        
        return {
          name: mrd.metadata?.name || 'unknown',
          namespace: mrd.metadata?.namespace || null,
          uid: mrd.metadata?.uid || '',
          creationTimestamp: mrd.metadata?.creationTimestamp || '',
          labels: mrd.metadata?.labels || {},
          group: mrd.spec?.group || '',
          names: mrd.spec?.names || {},
          versions: mrd.spec?.versions || [],
          scope: mrd.spec?.scope || '',
          state,
          established,
          spec: mrd.spec || {},
          status: mrd.status || {},
          conditions,
        };
      });
    } catch (error) {
      throw new Error(`Failed to get managed resource definitions: ${error.message}`);
    }
  }
}
