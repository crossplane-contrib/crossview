import { IKubernetesRepository } from '../../domain/repositories/IKubernetesRepository.js';

export class KubernetesApiRepository extends IKubernetesRepository {
  constructor(apiBaseUrl = '/api') {
    super();
    this.apiBaseUrl = apiBaseUrl;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // For 500 errors, try to get error message but don't break the app
        if (response.status === 500) {
          const error = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(error.message || `Server error: ${response.status}`);
        }
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Backend API is not available. Please ensure the backend server is running.');
      }
      throw error;
    }
  }

  async getContexts() {
    try {
      return await this.request('/contexts');
    } catch (error) {
      throw new Error(`Failed to get contexts: ${error.message}`);
    }
  }

  async getCurrentContext() {
    try {
      const result = await this.request('/contexts/current');
      return result.context || null;
    } catch (error) {
      return null;
    }
  }

  async setContext(contextName) {
    try {
      await this.request('/contexts/current', {
        method: 'POST',
        body: JSON.stringify({ context: contextName }),
      });
    } catch (error) {
      throw new Error(`Failed to set context: ${error.message}`);
    }
  }

  async isConnected(context = null) {
    try {
      const params = context ? new URLSearchParams({ context }) : '';
      const result = await this.request(`/kubernetes/connection${params ? `?${params}` : ''}`);
      return result.connected || false;
    } catch (error) {
      return false;
    }
  }

  async getNamespaces(context = null) {
    try {
      const params = context ? new URLSearchParams({ context }) : '';
      return await this.request(`/namespaces${params ? `?${params}` : ''}`);
    } catch (error) {
      throw new Error(`Failed to get namespaces: ${error.message}`);
    }
  }

  async getResources(apiVersion, kind, namespace = null, context = null, limit = null, continueToken = null, plural = null) {
    try {
      const params = new URLSearchParams({ apiVersion, kind });
      if (namespace) {
        params.append('namespace', namespace);
      }
      if (context) {
        params.append('context', context);
      }
      if (limit) {
        params.append('limit', limit.toString());
      }
      if (continueToken) {
        params.append('continue', continueToken);
      }
      if (plural) {
        params.append('plural', plural);
      }
      const result = await this.request(`/resources?${params.toString()}`);
      // Return in the same format as KubernetesRepository
      return {
        items: result.items || result, // Support both new format and legacy array format
        continueToken: result.continueToken || null,
        remainingItemCount: result.remainingItemCount || null
      };
    } catch (error) {
      throw new Error(`Failed to get resources: ${error.message}`);
    }
  }

  async getResource(apiVersion, kind, name, namespace = null, context = null, plural = null) {
    try {
      const params = new URLSearchParams({ apiVersion, kind, name });
      if (namespace) {
        params.append('namespace', namespace);
      }
      if (context) {
        params.append('context', context);
      }
      if (plural) {
        params.append('plural', plural);
      }
      return await this.request(`/resource?${params.toString()}`);
    } catch (error) {
      throw new Error(`Failed to get resource: ${error.message}`);
    }
  }

  async getManagedResources(context = null, forceRefresh = false, options = {}) {
    try {
      const params = new URLSearchParams();
      if (context) {
        params.append('context', context);
      }
      if (forceRefresh) {
        params.append('refresh', 'true');
      }
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }
      if (options.continueToken) {
        params.append('continue', options.continueToken);
      }
      if (options.kind) {
        params.append('kind', options.kind);
      }
      if (options.search) {
        params.append('search', options.search);
      }
      const queryString = params.toString();
      const endpoint = `/managed${queryString ? `?${queryString}` : ''}`;
      const result = await this.request(endpoint);
      return {
        items: result.items || [],
        fromCache: result.fromCache || false,
        totalCount: typeof result.totalCount === 'number' ? result.totalCount : (result.items || []).length,
        continueToken: result.continueToken || null
      };
    } catch (error) {
      throw new Error(`Failed to get managed resources: ${error.message}`);
    }
  }

  async getEvents(kind, name, namespace = null, context = null) {
    try {
      const params = new URLSearchParams({ kind, name });
      if (namespace) {
        params.append('namespace', namespace);
      }
      if (context) {
        params.append('context', context);
      }
      return await this.request(`/events?${params.toString()}`);
    } catch (error) {
      console.warn('Failed to get events:', error.message);
      return [];
    }
  }

  async addKubeConfig(kubeConfig) {
    try {
      return await this.request('/contexts/add', {
        method: 'POST',
        body: JSON.stringify({ kubeConfig }),
      });
    } catch (error) {
      throw new Error(`Failed to add kubeconfig: ${error.message}`);
    }
  }

  async removeContext(contextName) {
    try {
      return await this.request('/contexts', {
        method: 'DELETE',
        body: JSON.stringify({ context: contextName }),
      });
    } catch (error) {
      throw new Error(`Failed to remove context: ${error.message}`);
    }
  }
}

