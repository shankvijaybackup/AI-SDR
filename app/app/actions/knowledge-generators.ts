'use server'

import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '')

export async function generateMindMap(sourceId: string, force: boolean = false) {
    try {
        const source = await prisma.knowledgeSource.findUnique({
            where: { id: sourceId },
            include: { mindMap: true }
        })

        if (!source || !source.content) {
            console.error(`Source ${sourceId} has no content`, source)
            throw new Error('Source not found or empty')
        }

        console.log(`Generating MindMap for source ${sourceId} with content length: ${source.content.length}`)

        // TODO: Add force regenerate param
        // TODO: Add force regenerate param
        if (!force && source.mindMap && source.mindMap.length > 0) {
            console.log('Returning existing mindmap')
            return source.mindMap[0]
        }

        // If forcing, delete existing
        if (force && source.mindMap && source.mindMap.length > 0) {
            await prisma.mindMap.deleteMany({ where: { sourceId } })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' })
        const prompt = `
      You are an expert at creating educational mind maps.
      Analyze the following text and create a mind map structure.
      Return ONLY a valid JSON object with two arrays: "nodes" and "edges".
      
      Nodes should have:
      - id: string
      - label: string (concise concept)
      - type: "default" | "input" | "output"
      
      Edges should have:
      - id: string
      - source: node id
      - target: node id
      - label?: string (relationship description)

      Keep the structure hierarchical. The main topic should be the root node.
      Limit to 15-20 nodes max for clarity.

      Text to analyze:
      ${source.content.substring(0, 15000)}
    `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim()
        const data = JSON.parse(text)

        // Basic layouting (simple vertical spacing) will be handled by UI or Dagre, 
        // but here we ensure data structure is valid.

        const mindMap = await prisma.mindMap.create({
            data: {
                sourceId,
                data: data
            }
        })

        return mindMap
    } catch (error) {
        console.error('Error generating mind map:', error)
        throw error
    }
}

export async function generateFlashcards(sourceId: string, force: boolean = false) {
    try {
        const source = await prisma.knowledgeSource.findUnique({
            where: { id: sourceId },
            include: { flashcards: true }
        })

        if (!source || !source.content) {
            console.error(`Source ${sourceId} has no content`, source)
            throw new Error('Source not found or empty')
        }

        console.log(`Generating Flashcards for source ${sourceId} with content length: ${source.content.length}`)

        if (!force && source.flashcards.length > 0) {
            console.log('Returning existing flashcards')
            return source.flashcards
        }

        // If forcing, delete existing
        if (force && source.flashcards.length > 0) {
            await prisma.flashcard.deleteMany({ where: { sourceId } })
        }


        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' })
        const prompt = `
      You are an expert sales trainer creating flashcards for an SDR (Sales Development Representative).
      Your goal is to ensure the SDR masters the "Knowledge Source" provided below to effectively pitch and handle objections.

      Analyze the text and create 5-10 high-impact Q&A flashcards.
      
      shape the flashcards around these key areas if present in the text:
      1. **Customer References**: Specific customer names, their challenges, and how they succeeded (e.g., "How did [Customer] reduce costs?").
      2. **Hard Data & Metrics**: ROI numbers, performance percentages, speed improvements.
      3. **Key Value Props**: What differentiates this product?
      4. **Technical Capabilities**: Specific features and how they work.

      Return ONLY a valid JSON array of objects with "front" and "back" keys.
      - Front: A challenging question or prompt (e.g., "What is the ROI for X?").
      - Back: The specific, data-backed answer.

      Text to analyze:
      ${source.content.substring(0, 15000)}
    `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim()
        const cards = JSON.parse(text)

        if (!Array.isArray(cards)) {
            throw new Error('Invalid response format')
        }

        // Batch create
        await prisma.$transaction(
            cards.map((card: any) =>
                prisma.flashcard.create({
                    data: {
                        sourceId,
                        front: card.front,
                        back: card.back
                    }
                })
            )
        )

        return await prisma.flashcard.findMany({ where: { sourceId } })
    } catch (error) {
        console.error('Error generating flashcards:', error)
        throw error
    }
}

export async function generateGlobalMindMap(userId: string, force: boolean = false) {
    try {
        // Check for existing global mindmap
        const existingMindMap = await prisma.mindMap.findFirst({
            where: { userId, sourceId: null }
        })

        if (!force && existingMindMap) {
            console.log('Returning existing global mindmap')
            return existingMindMap
        }

        if (force && existingMindMap) {
            await prisma.mindMap.delete({ where: { id: existingMindMap.id } })
        }

        // Fetch all knowledge sources for the user (including shared ones created by them)
        const sources = await prisma.knowledgeSource.findMany({
            where: {
                OR: [
                    { userId },
                    { createdBy: userId }
                ],
                status: 'completed'
            }
        })

        if (sources.length === 0) {
            // Return empty or throw? Better to return null or empty structure
            console.log('No knowledge sources found for user')
            return null
        }

        // Aggregate content (naive: just concat, maybe limit total length)
        // Gemini 2.0 Flash has huge context, so we can be generous
        const combinedContent = sources
            .map(s => `--- Source: ${s.fileName} ---\n${s.content}`)
            .join('\n\n')
            .substring(0, 500000)

        if (!combinedContent.trim()) {
            throw new Error('No content available across knowledge sources')
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' })
        const prompt = `
      You are an expert at creating educational mind maps.
      Analyze the following aggregated knowledge base and create a COMPREHENSIVE mind map structure.
      
      CRITICAL: Return ONLY valid JSON. No markdown formatting, no comments.
      
      Structure:
      {
        "nodes": [
          { "id": "root", "label": "Knowledge Base", "type": "input" },
          { "id": "child1", "label": "Concept", "type": "default" }
        ],
        "edges": [
          { "id": "e1-2", "source": "root", "target": "child1" }
        ]
      }

      Requirements:
      1. Create a deep hierarchy (at least 3 levels depth).
      2. Cover ALL major topics found in the text.
      3. Use concise labels (1-4 words).
      4. Ensure every node is connected to the root eventually.
      5. Generate at least 25-40 nodes to ensure coverage.

      Text to analyze:
      ${combinedContent}
    `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim()
        const data = JSON.parse(text)

        const mindMap = await prisma.mindMap.create({
            data: {
                userId,
                sourceId: null, // explicitly null for global
                data: data
            }
        })

        return mindMap

    } catch (error) {
        console.error('Error generating global mind map:', error)
        throw error
    }
}

export async function generateGlobalFlashcards(userId: string, force: boolean = false) {
    try {
        // Fetch existing global flashcards
        const existingCards = await prisma.flashcard.findMany({
            where: { userId, sourceId: null }
        })

        if (!force && existingCards.length > 0) {
            console.log('Returning existing global flashcards')
            return existingCards
        }

        if (force && existingCards.length > 0) {
            await prisma.flashcard.deleteMany({ where: { userId, sourceId: null } })
        }

        const sources = await prisma.knowledgeSource.findMany({
            where: {
                OR: [
                    { userId },
                    { createdBy: userId }
                ],
                status: 'completed'
            }
        })

        if (sources.length === 0) {
            return []
        }

        const combinedContent = sources
            .map(s => `--- Source: ${s.fileName} ---\n${s.content}`)
            .join('\n\n')
            .substring(0, 500000)

        if (!combinedContent.trim()) {
            throw new Error('No content available')
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' })
        const prompt = `
      You are an expert sales trainer creating flashcards for an SDR.
      Your goal is to ensure the SDR masters the ENTIRE Knowledge Base provided below.
      
      CRITICAL: Create at least 30-50 high-impact Q&A flashcards. Do not stop at 10.
      
      Analyze the text deeply. Extract every distinct:
      1. Customer Story (Problem -> Solution -> Result)
      2. Statistic/Metric (Exact numbers)
      3. Feature/Capability (How it works + benefit)
      4. Objection Handling (Scenario + Best Response)
      5. Competitive Differentiator (Us vs Them)

      Return ONLY a valid JSON array of objects with "front" and "back" keys.
      
      Text to analyze:
      ${combinedContent}
    `

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim()
        const cards = JSON.parse(text)

        if (!Array.isArray(cards)) {
            throw new Error('Invalid response format')
        }

        await prisma.$transaction(
            cards.map((card: any) =>
                prisma.flashcard.create({
                    data: {
                        userId,
                        sourceId: null,
                        front: card.front,
                        back: card.back
                    }
                })
            )
        )

        return await prisma.flashcard.findMany({ where: { userId, sourceId: null } })

    } catch (error) {
        console.error('Error generating global flashcards:', error)
        throw error
    }
}
