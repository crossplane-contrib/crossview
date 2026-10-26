export class IKubernetesRepository {
  async getContexts() {
    throw new Error('getContexts must be implemented');
  }

  async getCurrentContext() {
    throw new Error('getCurrentContext must be implemented');
  }

  async setContext(contextName) {
    throw new Error('setContext must be implemented');
  }

  async getNamespaces(context = null) {
    throw new Error('getNamespaces must be implemented');
  }

  async getResources(apiVersion, kind, namespace = null, context = null, limit = null, continueToken = null, plural = null) {
    throw new Error('getResources must be implemented');
  }

  async getResource(apiVersion, kind, name, namespace = null, context = null, plural = null) {
    throw new Error('getResource must be implemented');
  }

  async getGraph(context = null, options = {}) {
    throw new Error('getGraph must be implemented');
  }

  async isConnected(context = null) {
    throw new Error('isConnected must be implemented');
  }

  async getEvents(kind, name, namespace = null, context = null) {
    throw new Error('getEvents must be implemented');
  }
}

