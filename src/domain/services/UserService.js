import { withBasePath } from '../../basePath';
export class UserService {
  constructor(baseUrl = withBasePath('/api')) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getUsers() {
    try {
      return await this.request('/users');
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  async createUser({ username, email, password, role = 'user' }) {
    try {
      return await this.request('/users', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role }),
      });
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUser(id, { username, email, role, password }) {
    try {
      return await this.request(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ username, email, role, password }),
      });
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }
}

