'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [showMagicLink, setShowMagicLink] = useState(false)
  const [magicLinkUrl, setMagicLinkUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      router.push('/leads')
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setError('')
    setSuccess('')
    setMagicLinkLoading(true)

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Magic link sent! Check your email or use the link below.')
        if (data.magicLinkUrl) {
          setMagicLinkUrl(data.magicLinkUrl)
        }
      } else {
        setError(data.error || 'Failed to send magic link')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setMagicLinkLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your AI SDR account
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              {success}
              {magicLinkUrl && (
                <div className="mt-2">
                  <a 
                    href={magicLinkUrl} 
                    className="text-green-800 underline font-medium text-xs break-all"
                  >
                    Click here to login (for testing)
                  </a>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || magicLinkLoading}
            />
          </div>

          {!showMagicLink && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              
              <Button 
                type="button" 
                className="w-full" 
                disabled={loading}
                onClick={handleSubmit}
              >
                <Lock className="w-4 h-4 mr-2" />
                {loading ? 'Signing in...' : 'Sign in with Password'}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>
            </>
          )}

          <Button 
            type="button" 
            variant={showMagicLink ? "default" : "outline"}
            className="w-full" 
            disabled={magicLinkLoading}
            onClick={handleMagicLink}
          >
            <Mail className="w-4 h-4 mr-2" />
            {magicLinkLoading ? 'Sending...' : 'Send Magic Link'}
          </Button>

          {!showMagicLink && (
            <button
              type="button"
              className="w-full text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setShowMagicLink(true)}
            >
              Prefer passwordless login?
            </button>
          )}

          {showMagicLink && (
            <button
              type="button"
              className="w-full text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setShowMagicLink(false)}
            >
              Use password instead
            </button>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
