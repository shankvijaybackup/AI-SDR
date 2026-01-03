
import { GoogleGenerativeAI } from '@google/generative-ai'

const KEY = 'AIzaSyBjL5u49Xv5Qrw0iy54b-vmEXoj5ucyinI'

async function verifyKey() {
    console.log(`Testing API Key: ${KEY.slice(0, 8)}...`)

    try {
        const genAI = new GoogleGenerativeAI(KEY)
        // Try the stable model first
        const modelName = 'gemini-1.5-flash-001'
        console.log(`Attempting to generate with ${modelName}...`)

        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent('Hello, are you working?')
        const response = await result.response
        console.log('Success! Response:', response.text())

    } catch (error: any) {
        console.error('FAILED:')
        console.error(error.message)

        if (error.message.includes('404')) {
            console.log('Hint: Model not found. This key might not have access to Vertex AI / Generative AI.')
        } else if (error.message.includes('403')) {
            console.log('Hint: Permission denied. Check if "Generative Language API" is enabled in Google Cloud Console.')
        }
    }
}

verifyKey()
