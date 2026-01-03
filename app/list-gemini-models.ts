
import { GoogleGenerativeAI } from '@google/generative-ai'

const KEY = 'AIzaSyBjL5u49Xv5Qrw0iy54b-vmEXoj5ucyinI'

async function listModels() {
    console.log(`Listing models with key: ${KEY.slice(0, 8)}...`)

    // We can't list models directly via GoogleGenerativeAI helper easily without a model instance?
    // Actually the SDK has a ModelManager or we can just fetch the REST API.
    // Let's use fetch for raw clarity.

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`

    try {
        const res = await fetch(url)
        console.log(`Status: ${res.status} ${res.statusText}`)

        if (!res.ok) {
            console.log('Error Body:', await res.text())
            return
        }

        const data = await res.json()
        console.log('Available Models:')
        if (data.models) {
            data.models.forEach((m: any) => {
                console.log(m.name)
            })
        } else {
            console.log('No models returned.')
        }

    } catch (e: any) {
        console.error('Fetch error:', e.message)
    }
}

listModels()
