export class GetGraphUseCase {
  constructor(kubernetesRepository) {
    this.kubernetesRepository = kubernetesRepository;
  }

  async execute(context = null, options = {}) {
    const graph = await this.kubernetesRepository.getGraph(context, options);
    return {
      nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph?.edges) ? graph.edges : [],
      warnings: Array.isArray(graph?.warnings) ? graph.warnings : [],
    };
  }
}
