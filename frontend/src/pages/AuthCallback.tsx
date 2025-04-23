import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/components/ui/LoadingScreen'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Try to get the code from URL
    const parseHashParams = (hash: string) => {
      const params = new URLSearchParams(hash.replace('#', ''))
      return Object.fromEntries(params.entries())
    }

    // Exchange auth code for session
    const handleAuthCallback = async () => {
      try {
        // First check for error in the URL
        const hashParams = parseHashParams(window.location.hash)
        if (hashParams.error) {
          console.error('Auth error:', hashParams.error_description || hashParams.error)
          navigate('/')
          return
        }

        // Get session from URL
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error.message)
          navigate('/')
          return
        }

        // Success, redirect to dashboard
        if (data?.session) {
          console.log('Successfully authenticated')
          navigate('/dashboard')
        } else {
          // No session found in URL
          console.log('No session found in URL, redirecting home')
          navigate('/')
        }
      } catch (error) {
        console.error('Unexpected error during auth callback:', error)
        navigate('/')
      }
    }

    // Run the callback handler
    handleAuthCallback()
  }, [navigate])

  // Show loading screen while handling the callback
  return <LoadingScreen message="Finalizing authentication..." />
} 