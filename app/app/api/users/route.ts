import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:4000'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Only account owners can list users
    if (currentUser.role !== 'account_owner' && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only account owners can view users' }, { status: 403 })
    }

    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value

    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/api/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `auth-token=${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update user (role, isActive)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Only account owners can update users
    if (currentUser.role !== 'account_owner' && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only account owners can update users' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value

    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Cookie': `auth-token=${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
