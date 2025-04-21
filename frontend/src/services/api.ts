import axios from 'axios';
import { API_URL } from '@/config';

// Create an instance of axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token in requests
api.interceptors.request.use(
  async (config) => {
    try {
      // Try to get session from localStorage to avoid circular dependency with auth context
      const storedSession = localStorage.getItem('supabase.auth.token');
      
      if (storedSession) {
        const session = JSON.parse(storedSession);
        if (session?.currentSession?.access_token) {
          config.headers.Authorization = `Bearer ${session.currentSession.access_token}`;
        }
      }
      
      return config;
    } catch (error) {
      console.error('Error setting auth header:', error);
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Handle 401 responses (unauthorized)
    if (error.response && error.response.status === 401) {
      // You could trigger a sign out here or refresh token logic
      console.warn('Unauthorized API request');
    }
    
    return Promise.reject(error);
  }
);

export default api; 