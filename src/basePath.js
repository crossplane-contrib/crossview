// The URL prefix Crossview is served under (e.g. "/crossview"), injected into
// index.html by the server. Empty when served from the root.
const injected = typeof window === 'undefined' ? '' : window.__BASE_PATH__;

export const BASE_PATH = typeof injected === 'string' ? injected.replace(/\/+$/, '') : '';

export const withBasePath = (path) => `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
