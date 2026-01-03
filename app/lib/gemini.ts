
import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai'

// Priority list: Try specific stable versions first, then generic aliases, then fallback to Pro.
const MODELS_TO_TRY = [
    'gemini-2.0-flash',     // Newest Flash (User has access)
    'gemini-2.0-flash-exp', // Experimental
    'gemini-1.5-flash',     // Stable 1.5
    'gemini-1.5-flash-001', // Explicit 1.5
    'gemini-1.5-pro',       // Pro 1.5
    'gemini-flash-latest',  // Generic Latest
    'gemini-pro',           // Legacy 1.0 (fallback)
]

export interface GeminiRequestOptions {
    apiKey?: string
    systemInstruction?: string
    jsonMode?: boolean
}

export async function generateContentSafe(
    prompt: string,
    options: GeminiRequestOptions = {}
): Promise<GenerateContentResult> {
    const apiKey = options.apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
        throw new Error('Missing GOOGLE_AI_API_KEY or GEMINI_API_KEY')
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    let lastError: any = null
    const errors: string[] = []

    for (const modelName of MODELS_TO_TRY) {
        try {
            console.log(`[Gemini] Attempting generation with model: ${modelName}`)

            const modelConfig: any = {
                model: modelName
            }

            if (options.systemInstruction) {
                modelConfig.systemInstruction = options.systemInstruction
            }

            // v1beta is needed for some features, but let's stick to standard getGenerativeModel
            // The SDK handles versioning usually.
            const model = genAI.getGenerativeModel(modelConfig)

            const generationConfig: any = {}
            if (options.jsonMode) {
                generationConfig.responseMimeType = "application/json"
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig
            })

            const response = await result.response
            if (!response) {
                throw new Error('Empty response')
            }

            // Accessing text() can throw if safety blocks it
            const text = response.text()

            console.log(`[Gemini] Success with ${modelName}`)
            return result

        } catch (e: any) {
            console.warn(`[Gemini] Failed with ${modelName}: ${e.message}`)
            errors.push(`${modelName}: ${e.message}`)
            lastError = e

            // If it's a safety block, switching models MIGHT help (pro is less trigger happy?)
            // If it's 404/400/403, switching definitely helps.
        }
    }

    throw new Error(`All Gemini models failed. Errors: ${errors.join(', ')}`)
}
