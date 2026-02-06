import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { linkedinSessionCookie: true },
    })

    return NextResponse.json({ 
      hasLinkedIn: !!user?.linkedinSessionCookie,
      sessionCookie: user?.linkedinSessionCookie || null
    })
  } catch (error) {
    console.error('Get LinkedIn session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { sessionCookie } = await request.json()

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'LinkedIn session cookie is required' },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: currentUser.userId },
      data: { linkedinSessionCookie: sessionCookie },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update LinkedIn session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: currentUser.userId },
      data: { linkedinSessionCookie: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete LinkedIn session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
