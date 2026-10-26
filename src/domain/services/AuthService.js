import { withBasePath } from '../../basePath';
export class AuthService {
  constructor(apiBaseUrl = withBasePath('/api')) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
        ...options,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        error.isNetworkError = true;
      }
      throw error;
    }
  }

  async checkAuth() {
    try {
      return await this.request('/auth/check');
    } catch (error) {
      const wrappedError = new Error(`Failed to check authentication: ${error.message}`);
      wrappedError.isNetworkError = error.isNetworkError;
      wrappedError.name = error.name;
      wrappedError.originalError = error;
      throw wrappedError;
    }
  }

  async login({ username, password }) {
    try {
      return await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async register({ username, email, password, database }) {
    try {
      return await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, database }),
      });
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async getDatabaseConfig() {
    try {
      const result = await this.request('/config/database');
      console.log('AuthService.getDatabaseConfig result:', result);
      return result;
    } catch (error) {
      console.error('AuthService.getDatabaseConfig error:', error);
      return {
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
      };
    }
  }

  async logout() {
    try {
      return await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async getSSOStatus() {
    try {
      return await this.request('/auth/sso/status');
    } catch (error) {
      return {
        enabled: false,
        oidc: { enabled: false },
        saml: { enabled: false },
      };
    }
  }

  getOIDCLoginURL() {
    return `${this.apiBaseUrl}/auth/oidc`;
  }

  getSAMLLoginURL() {
    return `${this.apiBaseUrl}/auth/saml`;
  }
}

