import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Prisma } from '@prisma/client'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type StoredChunk = {
  text: string
  embedding: number[]
  metadata?: {
    chunkIndex?: number
    startChar?: number
    endChar?: number
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    magnitudeA += a[i] * a[i]
    magnitudeB += b[i] * b[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (magnitudeA * magnitudeB)
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET(req: NextRequest) {
  try {
    // Support both cookie auth (browser) and x-user-id header (backend service)
    const userIdHeader = req.headers.get('x-user-id')
    let userId: string
    
    if (userIdHeader) {
      userId = userIdHeader
    } else {
      const currentUser = getCurrentUserFromRequest(request)
      if (!currentUser) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      userId = currentUser.userId
    }

    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()
    const limit = Math.min(Number(searchParams.get('limit') || 5), 10)

    if (!query) {
      return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 })
    }

    const embeddingResp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })

    const queryEmbedding = embeddingResp.data[0]?.embedding
    if (!queryEmbedding) {
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 })
    }

    // Multi-tenancy: Search shared knowledge + user's own knowledge
    const sources = await prisma.knowledgeSource.findMany({
      where: {
        isActive: true,
        status: 'completed',
        chunks: { not: Prisma.JsonNull },
        OR: [
          { isShared: true },  // Shared knowledge
          { userId: userId },  // User's own knowledge
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        category: true,
        chunks: true,
        summary: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const candidates: Array<{
      sourceId: string
      sourceTitle: string
      sourceType: string
      category: string | null
      text: string
      similarity: number
      metadata?: StoredChunk['metadata']
    }> = []

    for (const s of sources) {
      const chunks = (s.chunks as unknown as StoredChunk[]) || []
      for (const ch of chunks) {
        if (!Array.isArray(ch.embedding) || ch.embedding.length === 0) continue
        const sim = cosineSimilarity(queryEmbedding, ch.embedding)
        candidates.push({
          sourceId: s.id,
          sourceTitle: s.title,
          sourceType: s.type,
          category: s.category ?? null,
          text: ch.text,
          similarity: sim,
          metadata: ch.metadata,
        })
      }
    }

    const top = candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return NextResponse.json({
      query,
      results: top,
      searchedSources: sources.length,
    })
  } catch (error) {
    console.error('Knowledge search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
