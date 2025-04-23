import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { toast } from '@/components/ui/use-toast'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // Helper to parse hash parameters from the URL
    const parseHashParams = (hash: string) => {
      if (!hash || hash.length === 0) return {}
      const hashWithoutPrefix = hash.startsWith('#') ? hash.substring(1) : hash
      const params = new URLSearchParams(hashWithoutPrefix)
      return Object.fromEntries(params.entries())
    }
    
    const handleAuthCallback = async () => {
      try {
        console.log('[AuthCallback] Processing authentication callback')
        
        // Check for error in the URL first
        const hashParams = parseHashParams(window.location.hash)
        if (hashParams.error) {
          const errorDescription = hashParams.error_description || hashParams.error
          console.error('[AuthCallback] Error in URL:', errorDescription)
          setError(errorDescription)
          
          setTimeout(() => {
            navigate('/')
          }, 3000)
          return
        }
        
        // If code and type parameters exist, we're handling an OAuth callback
        if (hashParams.code && hashParams.type) {
          console.log('[AuthCallback] Processing OAuth callback')
        }
        
        // Get the session (supabase will handle the token exchange)
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[AuthCallback] Error getting session:', error.message)
          setError(error.message)
          
          setTimeout(() => {
            navigate('/')
          }, 3000)
          return
        }
        
        if (data?.session) {
          // Success! We have a session
          console.log('[AuthCallback] Authentication successful')
          
          toast({
            title: 'Successfully signed in',
            description: 'Redirecting you to the dashboard...',
          })
          
          // Redirect to dashboard
          navigate('/dashboard')
        } else {
          // No session found
          console.warn('[AuthCallback] No session found in callback response')
          setError('Authentication failed. No session created.')
          
          setTimeout(() => {
            navigate('/')
          }, 3000)
        }
      } catch (err: any) {
        console.error('[AuthCallback] Unexpected error during auth callback:', err)
        setError(`Unexpected error: ${err.message || 'Unknown error'}`)
        
        setTimeout(() => {
          navigate('/')
        }, 3000)
      }
    }
    
    // Run the callback handler
    handleAuthCallback()
  }, [navigate])
  
  // Show error state if there was a problem
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">Authentication Error</h2>
          <p>{error}</p>
          <p className="text-sm mt-2">Redirecting to home page...</p>
        </div>
      </div>
    )
  }
  
  // Default loading state
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <LoadingScreen message="Completing authentication..." />
      <p className="mt-4 text-muted-foreground">Please wait while we set up your account...</p>
    </div>
  )
} 