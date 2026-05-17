/**
 * Centralized API utility for the ONEREAL LMS frontend.
 */

const getAuthToken = () => localStorage.getItem('onereal_token');

// In-memory cache for GET requests
const requestCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

interface ApiRequestOptions extends RequestInit {
  responseType?: 'json' | 'blob' | 'text';
}

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiFetch(endpoint: string, options: ApiRequestOptions = {}) {
  const token = getAuthToken();
  const { responseType = 'json', ...fetchOptions } = options;
  
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const fullUrl = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const response = await fetch(fullUrl, { ...fetchOptions, headers });
  
  if (response.status === 401) {
    localStorage.removeItem('onereal_token');
    window.dispatchEvent(new CustomEvent('auth_error'));
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  if (responseType === 'blob') return await response.blob();
  if (responseType === 'text') return await response.text();
  
  return await response.json();
}

export const api = {
  get: async (url: string, options: ApiRequestOptions = {}, forceFresh = false) => {
    if (!forceFresh && (!options || Object.keys(options).length === 0)) {
      const cached = requestCache.get(url);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
    }
    const data = await apiFetch(url, { ...options, method: 'GET' });
    if (!options.responseType || options.responseType === 'json') {
        requestCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
    }
    return data;
  },
  post: async (url: string, body: any, options: ApiRequestOptions = {}) => {
    const isFormData = body instanceof FormData;
    const data = await apiFetch(url, { 
        ...options, 
        method: 'POST', 
        body: isFormData ? body : JSON.stringify(body) 
    });
    requestCache.clear();
    return data;
  },
  put: async (url: string, body: any, options: ApiRequestOptions = {}) => {
    const isFormData = body instanceof FormData;
    const data = await apiFetch(url, { 
        ...options, 
        method: 'PUT', 
        body: isFormData ? body : JSON.stringify(body) 
    });
    requestCache.clear();
    return data;
  },
  delete: async (url: string, options: ApiRequestOptions = {}) => {
    const res = await apiFetch(url, { ...options, method: 'DELETE' });
    requestCache.clear();
    return res;
  },
  
  upload: async (url: string, formData: FormData, method = 'POST') => {
    const data = await apiFetch(url, { method, body: formData });
    requestCache.clear();
    return data;
  }
};
