export class GetPoliciesUseCase {
  constructor(kubernetesRepository) {
    this.kubernetesRepository = kubernetesRepository;
  }

  async execute(context = null) {
    try {
      const policyTypes = [
        { apiVersion: 'apiextensions.crossplane.io/v1alpha1', kind: 'CompositionValidationPolicy' },
      ];

      const allPolicies = [];

      for (const policyType of policyTypes) {
        try {
          const result = await this.kubernetesRepository.getResources(
            policyType.apiVersion, policyType.kind, null, context
          );
          const items = result.items || result;
          const itemsArray = Array.isArray(items) ? items : [];

          allPolicies.push(...itemsArray.map(policy => ({
            name: policy.metadata?.name || 'unknown',
            namespace: policy.metadata?.namespace || null,
            uid: policy.metadata?.uid || '',
            creationTimestamp: policy.metadata?.creationTimestamp || '',
            labels: policy.metadata?.labels || {},
            spec: policy.spec || {},
            status: policy.status || {},
            conditions: policy.status?.conditions || [],
            apiVersion: policyType.apiVersion,
            kind: policyType.kind,
          })));
        } catch {
        }
      }

      return allPolicies;
    } catch (error) {
      throw new Error(`Failed to get policies: ${error.message}`);
    }
  }
}
