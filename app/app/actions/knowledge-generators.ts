'use server'

import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

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
        if (!force && source.mindMap) {
            console.log('Returning existing mindmap')
            return source.mindMap
        }

        // If forcing, delete existing
        if (force && source.mindMap) {
            await prisma.mindMap.delete({ where: { id: source.mindMap.id } })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
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

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
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
