import axios from 'axios';
import { API_URL } from '@/config';
import { supabase } from '@/integrations/supabase/client';

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
      // Get session directly from Supabase instead of localStorage
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
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