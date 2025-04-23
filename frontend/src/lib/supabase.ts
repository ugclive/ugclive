import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config'

// Environment validation
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL environment variable')
}

if (!SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_ANON_KEY environment variable')
}

// Extract project reference from the URL for storage key
const getProjectRef = () => {
  try {
    if (!SUPABASE_URL) return 'unknown'
    const url = new URL(SUPABASE_URL)
    return url.hostname.split('.')[0]
  } catch (e) {
    // Fallback method if URL parsing fails
    const parts = SUPABASE_URL.replace('https://', '')
                           .replace('http://', '')
                           .split('.')
    return parts[0] || 'unknown'
  }
}

const PROJECT_REF = getProjectRef()
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

// Create the Supabase client
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: STORAGE_KEY,
      debug: process.env.NODE_ENV === 'development'
    },
    global: {
      headers: {
        'X-Client-Info': 'ugclive-frontend'
      }
    }
  }
)

// Utility function to diagnose the auth state (for debugging)
export const diagnoseAuthState = async () => {
  try {
    console.log('[AUTH] Running diagnostic...')
    
    // Check localStorage for token
    const token = localStorage.getItem(STORAGE_KEY)
    console.log('[AUTH] Token exists in localStorage:', !!token)
    
    if (token) {
      try {
        // Validate token is proper JSON
        JSON.parse(token)
      } catch (e) {
        console.error('[AUTH] Corrupted token found in localStorage, clearing')
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    
    // Get current session and user
    const { data: { session } } = await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Log auth status
    console.log('[AUTH] Session exists:', !!session)
    console.log('[AUTH] User exists:', !!user)
    
    if (session?.expires_at) {
      const expiresAt = new Date(session.expires_at * 1000)
      const now = new Date()
      const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 60000)
      console.log(`[AUTH] Session expires in ${minutesUntilExpiry} minutes`)
    }
    
    return {
      hasSession: !!session,
      hasUser: !!user,
      user: user ? { email: user.email, id: user.id } : null,
      session: session ? { 
        expires_at: session.expires_at,
        expires_in: session.expires_in
      } : null
    }
  } catch (error) {
    console.error('[AUTH] Diagnostic error:', error)
    return { error }
  }
} 