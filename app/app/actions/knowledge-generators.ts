'use server'

import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

export async function generateMindMap(sourceId: string) {
    try {
        const source = await prisma.knowledgeSource.findUnique({
            where: { id: sourceId },
            include: { mindMap: true }
        })

        if (!source || !source.content) {
            throw new Error('Source not found or empty')
        }

        if (source.mindMap) {
            return source.mindMap
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

export async function generateFlashcards(sourceId: string) {
    try {
        const source = await prisma.knowledgeSource.findUnique({
            where: { id: sourceId },
            include: { flashcards: true }
        })

        if (!source || !source.content) {
            throw new Error('Source not found or empty')
        }

        if (source.flashcards.length > 0) {
            return source.flashcards
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
        const prompt = `
      You are an expert at creating study flashcards.
      Analyze the following text and create 5-10 high-quality Q&A flashcards.
      Return ONLY a valid JSON array of objects with "front" and "back" keys.
      
      - Front: Question or Term
      - Back: Answer or Definition (concise)

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
