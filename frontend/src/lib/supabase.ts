import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config'

// Environment validation
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL environment variable')
}

if (!SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_ANON_KEY environment variable')
}

// Create the Supabase client
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Important: enable session detection in URL
    }
  }
)

// Utility function to diagnose the auth state (for debugging)
export const diagnoseAuthState = async () => {
  try {
    console.log('[AUTH] Running diagnostic...')
    
    // Get current session and user
    const { data: { session } } = await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Log auth status
    console.log('[AUTH] Session exists:', !!session)
    console.log('[AUTH] User exists:', !!user)
    
    if (user) {
      console.log('[AUTH] User email:', user.email)
      console.log('[AUTH] User ID:', user.id)
    }
    
    if (session) {
      console.log('[AUTH] Session expires at:', new Date(session.expires_at! * 1000).toLocaleString())
    }
    
    return {
      hasSession: !!session,
      hasUser: !!user,
      user: user ? { email: user.email, id: user.id } : null,
      session: session ? { expires_at: session.expires_at } : null
    }
  } catch (error) {
    console.error('[AUTH] Diagnostic error:', error)
    return { error }
  }
} 