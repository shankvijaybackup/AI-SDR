import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:4000'

// POST /api/leads/[id]/script/generate - Generate call script
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await params
    const token = request.cookies.get('auth-token')?.value

    const backendUrl = `${BACKEND_URL}/api/leads/${id}/script/generate`
    console.log('[Frontend API] Calling backend:', backendUrl)
    console.log('[Frontend API] BACKEND_URL env:', BACKEND_URL)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `auth-token=${token}`,
      },
    })

    console.log('[Frontend API] Backend response status:', response.status)

    const data = await response.json()
    console.log('[Frontend API] Backend response data:', JSON.stringify(data).substring(0, 200))

    if (!response.ok) {
      console.error('[Frontend API] Backend error:', data)
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Frontend API] ❌ CRITICAL ERROR:', error)
    console.error('[Frontend API] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[Frontend API] BACKEND_URL:', BACKEND_URL)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        backendUrl: BACKEND_URL
      },
      { status: 500 }
    )
  }
}
