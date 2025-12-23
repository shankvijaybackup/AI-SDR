'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function CallingPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to bulk-calling page - individual calls now done via Quick Call Modal on Leads page
    router.push('/bulk-calling')
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-slate-500">Redirecting to Bulk Calling...</p>
      </div>
    </div>
  )
}

