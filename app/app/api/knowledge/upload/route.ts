import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromExcel,
  extractTextFromPowerPoint,
  extractTextFromVideo,
  extractTextFromPlainText,
  transcribeVideo,
  fetchContentFromURL,
  processDocument,
} from '@/lib/document-processor'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const type = formData.get('type') as string // 'document', 'video', 'url', 'text'
    const category = formData.get('category') as string | null
    const tags = formData.get('tags') as string | null

    if (!title || !type) {
      return NextResponse.json(
        { error: 'Title and type are required' },
        { status: 400 }
      )
    }

    let content = ''
    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileSize: number | null = null
    let mimeType: string | null = null
    let videoUrl: string | null = null
    let videoTranscript: string | null = null

    // Process based on type
    if (type === 'document') {
      // Support multiple files
      const files = formData.getAll('files') as File[]
      
      // Fallback to single file for backward compatibility
      if (files.length === 0) {
        const singleFile = formData.get('file') as File
        if (singleFile) {
          files.push(singleFile)
        }
      }
      
      if (files.length === 0) {
        return NextResponse.json({ error: 'At least one file is required' }, { status: 400 })
      }
      
      if (files.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 files allowed at once' }, { status: 400 })
      }

      // Process each file and create separate knowledge sources
      const results = []
      
      for (const file of files) {
        let fileContent = ''
        const fileMimeType = file.type
        const buffer = Buffer.from(await file.arrayBuffer())

        // Extract text based on file type
        if (fileMimeType === 'application/pdf') {
          fileContent = await extractTextFromPDF(buffer)
        } else if (
          fileMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          fileMimeType === 'application/msword'
        ) {
          fileContent = await extractTextFromDOCX(buffer)
        } else if (
          fileMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          fileMimeType === 'application/vnd.ms-excel'
        ) {
          fileContent = await extractTextFromExcel(buffer)
        } else if (
          fileMimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          fileMimeType === 'application/vnd.ms-powerpoint'
        ) {
          fileContent = await extractTextFromPowerPoint(buffer)
        } else if (
          fileMimeType === 'video/mp4' ||
          fileMimeType === 'video/quicktime' ||
          fileMimeType === 'video/x-msvideo' ||
          fileMimeType === 'video/x-matroska'
        ) {
          // Skip video files with error
          results.push({ fileName: file.name, error: 'Video files not supported. Use YouTube URL.' })
          continue
        } else if (fileMimeType?.startsWith('text/')) {
          fileContent = extractTextFromPlainText(buffer)
        } else {
          results.push({ fileName: file.name, error: `Unsupported file type: ${fileMimeType}` })
          continue
        }

        // Create knowledge source for this file
        const fileTitle = files.length > 1 ? `${title} - ${file.name}` : title
        
        // Multi-tenancy: Knowledge is shared by default
        const knowledgeSource = await prisma.knowledgeSource.create({
          data: {
            userId: null,  // Shared knowledge has no owner
            title: fileTitle,
            description,
            type,
            fileUrl: null,
            fileName: file.name,
            fileSize: file.size,
            mimeType: fileMimeType,
            videoUrl: null,
            videoTranscript: null,
            content: fileContent,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            category,
            status: 'processing',
            isShared: true,
            createdBy: currentUser.userId,  // Track who created it
          },
        })

        // Process document asynchronously
        processDocumentAsync(knowledgeSource.id, fileContent, type as any)
        
        results.push({ id: knowledgeSource.id, fileName: file.name, status: 'processing' })
      }

      return NextResponse.json({
        count: results.filter(r => !r.error).length,
        results,
        message: `${results.filter(r => !r.error).length} file(s) uploaded successfully. Processing embeddings...`,
      })
    } else if (type === 'video') {
      videoUrl = formData.get('videoUrl') as string
      if (!videoUrl) {
        return NextResponse.json({ error: 'Video URL is required' }, { status: 400 })
      }

      // Transcribe video
      videoTranscript = await transcribeVideo(videoUrl)
      content = videoTranscript
    } else if (type === 'url') {
      const url = formData.get('url') as string
      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 })
      }

      fileUrl = url
      content = await fetchContentFromURL(url)
    } else if (type === 'text') {
      content = formData.get('content') as string
      if (!content) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Multi-tenancy: Knowledge is shared by default
    const knowledgeSource = await prisma.knowledgeSource.create({
      data: {
        userId: null,  // Shared knowledge has no owner
        title,
        description,
        type,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        videoUrl,
        videoTranscript,
        content,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        category,
        status: 'processing',
        isShared: true,
        createdBy: currentUser.userId,  // Track who created it
      },
    })

    // Process document asynchronously (in production, use a queue)
    processDocumentAsync(knowledgeSource.id, content, type as any)

    return NextResponse.json({
      id: knowledgeSource.id,
      status: 'processing',
      message: 'Document uploaded successfully. Processing embeddings...',
    })
  } catch (error) {
    console.error('Knowledge upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Process document asynchronously
 */
async function processDocumentAsync(
  knowledgeSourceId: string,
  content: string,
  type: 'document' | 'video' | 'url' | 'text'
) {
  try {
    console.log(`[Knowledge] Processing document ${knowledgeSourceId}`)

    const processed = await processDocument(content, type)

    await prisma.knowledgeSource.update({
      where: { id: knowledgeSourceId },
      data: {
        summary: processed.summary,
        chunks: processed.chunks as any,
        status: 'completed',
      },
    })

    console.log(`[Knowledge] Document ${knowledgeSourceId} processed successfully`)
  } catch (error) {
    console.error(`[Knowledge] Processing error for ${knowledgeSourceId}:`, error)

    await prisma.knowledgeSource.update({
      where: { id: knowledgeSourceId },
      data: {
        status: 'failed',
        processingError: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}
