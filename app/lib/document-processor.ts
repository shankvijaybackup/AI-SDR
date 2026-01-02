// Document processing service for knowledge base uploads
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as XLSX from 'xlsx'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '')

interface ProcessedDocument {
  content: string
  summary: string
  chunks: Array<{
    text: string
    embedding: number[]
    metadata: {
      chunkIndex: number
      startChar: number
      endChar: number
    }
  }>
}

// ... (existing interfaces)

// ... (existing extraction functions: PDF, DOCX, Excel, PPT, etc.)

/**
 * Generate embeddings for text chunks using Gemini
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

    // Gemini supports batch embedding, but let's do it carefully or per chunk if needed
    // text-embedding-004 supports batching
    const embeddings: number[][] = []

    // Gemini might have limits on batch size, let's process in small batches
    const batchSize = 10
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      /**
       * Note: Gemini API for embeddings might be slightly different depending on version.
       * Using batchEmbedContents if available, or iterating.
       * The standard JS SDK usually provides embedContent which takes one.
       * For safety/compatibility with standard SDK, we'll map.
       */
      const batchPromises = batch.map(text => model.embedContent(text))
      const batchResults = await Promise.all(batchPromises)
      embeddings.push(...batchResults.map(r => r.embedding.values))
    }

    return embeddings
  } catch (error) {
    console.error('[Embeddings] Generation error:', error)
    // Fallback or rethrow
    // If Gemini fails (e.g. key missing), we can't proceed with RAG.
    throw new Error('Failed to generate embeddings: ' + (error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Generate summary of content using Gemini
 */
export async function generateSummary(content: string, maxLength: number = 500): Promise<string> {
  try {
    // Truncate content if too long (Gemini 1.5 Flash has huge window but let's be reasonable)
    const truncatedContent = content.slice(0, 30000)

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' })
    const prompt = `You are a helpful assistant that creates concise summaries of documents for a sales knowledge base. Focus on key points, features, benefits, and use cases.
    
    Summarize the following content in ${maxLength} characters or less:\n\n${truncatedContent}`

    const result = await model.generateContent(prompt)
    return result.response.text() || 'Summary generation failed'
  } catch (error) {
    console.error('[Summary] Generation error:', error)
    return 'Summary not available'
  }
}

/**
 * Extract text from PDF using unpdf (modern PDF.js wrapper)
 */
export async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  try {
    const { extractText } = await import('unpdf')

    console.log('[Document] PDF Processing with unpdf:')
    console.log('- Buffer size:', fileBuffer.byteLength, 'bytes')

    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(fileBuffer)

    const result = await extractText(uint8Array)

    // unpdf returns text as an array of strings (one per page)
    const textContent = Array.isArray(result.text)
      ? result.text.join('\n')
      : String(result.text)

    if (!textContent || textContent.trim().length === 0) {
      throw new Error('PDF appears to be empty or contains no extractable text')
    }

    console.log(`[PDF] Extracted ${textContent.length} characters from ${result.totalPages} pages`)
    return textContent
  } catch (error) {
    console.error('[Document] PDF extraction error:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`)
    }
    throw new Error('Failed to extract text from PDF')
  }
}

/**
 * Extract text from DOCX using mammoth
 */
export async function extractTextFromDOCX(fileBuffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: fileBuffer })

    if (!result.value || result.value.trim().length === 0) {
      throw new Error('DOCX appears to be empty or contains no extractable text')
    }

    console.log(`[DOCX] Extracted ${result.value.length} characters`)
    return result.value
  } catch (error) {
    console.error('[Document] DOCX extraction error:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to extract text from DOCX: ${error.message}`)
    }
    throw new Error('Failed to extract text from DOCX')
  }
}

/**
 * Extract text from Excel files (XLS, XLSX)
 */
export async function extractTextFromExcel(fileBuffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    let allText = ''

    // Iterate through all sheets
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      allText += `\n\n=== Sheet: ${sheetName} ===\n`

      // Convert sheet to CSV format for better text extraction
      const csv = XLSX.utils.sheet_to_csv(sheet)
      allText += csv
    })

    if (!allText || allText.trim().length === 0) {
      throw new Error('Excel file appears to be empty')
    }

    console.log(`[Excel] Extracted ${allText.length} characters from ${workbook.SheetNames.length} sheets`)
    return allText.trim()
  } catch (error) {
    console.error('[Document] Excel extraction error:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to extract text from Excel: ${error.message}`)
    }
    throw new Error('Failed to extract text from Excel')
  }
}

/**
 * Extract text from PowerPoint files (PPT, PPTX)
 */
export async function extractTextFromPowerPoint(fileBuffer: Buffer): Promise<string> {
  try {
    const JSZip = require('jszip')
    const zip = await JSZip.loadAsync(fileBuffer)
    let fullText = ''

    // Find all slide files
    const slideFiles: any[] = []
    zip.forEach((relativePath: string, file: any) => {
      if (relativePath.match(/^ppt\/slides\/slide\d+\.xml$/)) {
        slideFiles.push({ path: relativePath, file })
      }
    })

    // Sort slides by number to maintain order
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.path.match(/slide(\d+)\.xml/)[1])
      const numB = parseInt(b.path.match(/slide(\d+)\.xml/)[1])
      return numA - numB
    })

    // Extract text from each slide
    for (const slide of slideFiles) {
      const content = await slide.file.async('string')
      // Simple regex to extract text from <a:t> tags
      // This covers most standard text in PPTX
      const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g)
      if (textMatches) {
        const slideText = textMatches
          .map((tag: string) => tag.replace(/<\/?a:t>/g, ''))
          .join(' ')
        fullText += slideText + '\n\n'
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      // Fallback: try to just strip tags if specific tags weren't found
      // This handles some edge cases in XML structure
      console.log('[PowerPoint] specific tags not found, trying general extraction')
    }

    return fullText.trim() || 'PowerPoint file processed (no text content found)'
  } catch (error) {
    console.error('[Document] PowerPoint extraction error:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to extract text from PowerPoint: ${error.message}`)
    }
    throw new Error('Failed to extract text from PowerPoint')
  }
}

/**
 * Extract audio from video file and transcribe using Whisper
 * NOTE: Direct video upload not supported in Next.js due to FFmpeg compatibility.
 * Use YouTube URLs instead or implement video processing in a separate service.
 */
export async function extractTextFromVideo(fileBuffer: Buffer, fileName: string): Promise<string> {
  throw new Error('Direct video file upload not supported. Please use YouTube URL upload instead, or contact support for video processing options.')
}

/**
 * Extract text from plain text files
 */
export function extractTextFromPlainText(fileBuffer: Buffer): string {
  return fileBuffer.toString('utf-8')
}

/**
 * Transcribe video using OpenAI Whisper API
 */
export async function transcribeVideo(videoUrl: string): Promise<string> {
  try {
    // For YouTube videos, use youtube-transcript library
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      return await transcribeYouTubeVideo(videoUrl)
    }

    // For uploaded videos, would need to:
    // 1. Extract audio from video
    // 2. Send to Whisper API
    // For now, return placeholder
    throw new Error('Direct video transcription not yet implemented. Use YouTube URLs.')
  } catch (error) {
    console.error('[Video] Transcription error:', error)
    throw error
  }
}

/**
 * Get YouTube video transcript
 */
async function transcribeYouTubeVideo(url: string): Promise<string> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript')

    // Extract video ID from URL
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      throw new Error('Invalid YouTube URL')
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    return transcript.map(item => item.text).join(' ')
  } catch (error) {
    console.error('[YouTube] Transcript error:', error)
    throw new Error('Failed to get YouTube transcript. Make sure the video has captions enabled.')
  }
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Fetch content from URL
 */
export async function fetchContentFromURL(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('text/html')) {
      // Parse HTML and extract main content
      const html = await response.text()
      return extractTextFromHTML(html)
    } else if (contentType.includes('text/plain')) {
      return await response.text()
    } else {
      throw new Error(`Unsupported content type: ${contentType}`)
    }
  } catch (error) {
    console.error('[URL] Fetch error:', error)
    throw new Error('Failed to fetch content from URL')
  }
}

/**
 * Extract text from HTML (simple version)
 */
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Chunk text into smaller pieces for embeddings
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length)
    const chunk = text.slice(startIndex, endIndex)
    chunks.push(chunk)

    // Move to next chunk with overlap
    startIndex += chunkSize - overlap
  }

  return chunks
}

// End of extraction helpers

/**
 * Process document and generate embeddings
 */
export async function processDocument(
  content: string,
  type: 'document' | 'video' | 'url' | 'text'
): Promise<ProcessedDocument> {
  try {
    console.log(`[Document] Processing ${type}, length: ${content.length} chars`)

    // Generate summary
    const summary = await generateSummary(content)

    // Chunk the content
    const textChunks = chunkText(content, 1000, 200)
    console.log(`[Document] Created ${textChunks.length} chunks`)

    // Generate embeddings for chunks
    const embeddings = await generateEmbeddings(textChunks)
    console.log(`[Document] Generated ${embeddings.length} embeddings`)

    // Build chunks with metadata
    const chunks = textChunks.map((text, index) => ({
      text,
      embedding: embeddings[index],
      metadata: {
        chunkIndex: index,
        startChar: index * 800, // Approximate
        endChar: Math.min((index + 1) * 800, content.length),
      }
    }))

    return {
      content,
      summary,
      chunks,
    }
  } catch (error) {
    console.error('[Document] Processing error:', error)
    throw error
  }
}

/**
 * Find similar chunks using cosine similarity
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  chunks: Array<{ text: string; embedding: number[] }>,
  topK: number = 3
): Array<{ text: string; similarity: number }> {
  // Calculate cosine similarity for each chunk
  const similarities = chunks.map(chunk => ({
    text: chunk.text,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
  }))

  // Sort by similarity and return top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

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

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dotProduct / (magnitudeA * magnitudeB)
}
