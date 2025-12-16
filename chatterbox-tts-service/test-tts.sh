#!/bin/bash

# Quick TTS Test Script
# Tests Chatterbox TTS service with sample text

CHATTERBOX_URL="${CHATTERBOX_TTS_URL:-http://localhost:8001}"

echo "🧪 Testing Chatterbox TTS Service"
echo "================================="
echo ""

# Check health
echo "1️⃣ Health Check..."
health=$(curl -s "$CHATTERBOX_URL/health")
echo "$health" | python3 -m json.tool
echo ""

if ! echo "$health" | grep -q '"status": "healthy"'; then
    echo "❌ Service is not healthy"
    exit 1
fi

echo "✅ Service is healthy"
echo ""

# Test synthesis
echo "2️⃣ Testing TTS Synthesis..."
echo "Text: 'Hey, this is Alex from Atomicwork. How are you doing today?'"
echo ""

curl -X POST "$CHATTERBOX_URL/synthesize" \
    -H "Content-Type: application/json" \
    -d '{
        "text": "Hey, this is Alex from Atomicwork. How are you doing today?",
        "voice_id": "default",
        "exaggeration": 0.5,
        "cfg_weight": 0.5,
        "output_format": "mp3"
    }' \
    --output test_output.mp3

if [ -f test_output.mp3 ]; then
    size=$(wc -c < test_output.mp3)
    echo ""
    echo "✅ Audio generated successfully!"
    echo "   File: test_output.mp3"
    echo "   Size: $size bytes"
    echo ""
    echo "🎵 Play the audio with:"
    echo "   ffplay test_output.mp3"
    echo "   or"
    echo "   open test_output.mp3"
else
    echo "❌ Failed to generate audio"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
