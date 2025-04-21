// Configuration values for the application
// These values can be overridden by environment variables

// API URL for backend services
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Supabase configuration
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// App configuration
export const APP_NAME = 'UGClive';
export const APP_VERSION = '1.0.0';

// Application configuration
export const BASE_URL = import.meta.env.VITE_BASE_URL;
