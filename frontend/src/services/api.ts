import axios from 'axios';
import { API_URL } from '@/config';
import { supabase } from '@/lib/supabase';

// Create an instance of axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function to get the current session token - this will be updated by AuthContext
let currentSessionToken: string | null = null;

export const setSessionToken = (token: string | null) => {
  currentSessionToken = token;
};

// Add a request interceptor to include the token in requests
api.interceptors.request.use(
  async (config) => {
    try {
      // First try to use the token from AuthContext
      if (currentSessionToken) {
        config.headers.Authorization = `Bearer ${currentSessionToken}`;
        return config;
      }
      
      // Fallback to direct Supabase call if token not set yet
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        // Cache the token for future requests
        setSessionToken(session.access_token);
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
      // Clear the cached token on 401
      setSessionToken(null);
      console.warn('Unauthorized API request');
    }
    
    return Promise.reject(error);
  }
);

export default api; 