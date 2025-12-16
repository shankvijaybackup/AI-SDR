'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function MagicLinkPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No magic link token provided')
      return
    }

    verifyMagicLink()
  }, [token])

  const verifyMagicLink = async () => {
    try {
      const response = await fetch('/api/auth/magic-link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setMessage(data.message || 'Login successful!')
        // Redirect to dashboard after 1 second
        setTimeout(() => router.push('/leads'), 1000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Login failed')
      }
    } catch (error) {
      setStatus('error')
      setMessage('An error occurred during login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Magic Link Login</CardTitle>
          <CardDescription>Signing you in securely</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-slate-600">Signing you in...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-green-700 font-medium">{message}</p>
              <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="w-12 h-12 text-red-500" />
              <p className="text-red-700 font-medium">{message}</p>
              <div className="space-y-2">
                <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
                  Go to Login
                </Button>
                <p className="text-xs text-slate-500">
                  Magic links expire after 15 minutes
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
