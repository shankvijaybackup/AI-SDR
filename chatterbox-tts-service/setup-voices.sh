#!/bin/bash

# Voice Cloning Setup Script for Chatterbox TTS
# This script helps you clone voices for your AI SDR

set -e

CHATTERBOX_URL="${CHATTERBOX_TTS_URL:-http://localhost:8001}"
VOICES_DIR="./voices"

echo "🎤 Chatterbox Voice Cloning Setup"
echo "=================================="
echo ""

# Create voices directory
mkdir -p "$VOICES_DIR"

# Function to clone a voice
clone_voice() {
    local voice_id=$1
    local audio_file=$2
    local description=$3
    
    echo "📤 Cloning voice: $voice_id"
    echo "   Audio file: $audio_file"
    echo "   Description: $description"
    
    curl -X POST "$CHATTERBOX_URL/clone-voice" \
        -F "voice_id=$voice_id" \
        -F "audio_file=@$audio_file" \
        -F "description=$description"
    
    echo ""
    echo "✅ Voice '$voice_id' cloned successfully!"
    echo ""
}

# Check if Chatterbox service is running
echo "🔍 Checking Chatterbox service..."
if ! curl -s "$CHATTERBOX_URL/health" > /dev/null 2>&1; then
    echo "❌ Error: Chatterbox service is not running at $CHATTERBOX_URL"
    echo "   Please start the service first:"
    echo "   cd chatterbox-tts-service && docker-compose up -d"
    exit 1
fi

echo "✅ Chatterbox service is running"
echo ""

# Interactive voice cloning
echo "📝 Voice Cloning Options:"
echo "1. Clone 'alex' voice (male SDR)"
echo "2. Clone 'sarah' voice (female SDR)"
echo "3. Clone custom voice"
echo "4. List existing voices"
echo "5. Exit"
echo ""

read -p "Select option (1-5): " option

case $option in
    1)
        read -p "Path to Alex voice sample (WAV file): " audio_file
        if [ ! -f "$audio_file" ]; then
            echo "❌ File not found: $audio_file"
            exit 1
        fi
        clone_voice "alex" "$audio_file" "Professional male SDR voice - warm and confident"
        ;;
    2)
        read -p "Path to Sarah voice sample (WAV file): " audio_file
        if [ ! -f "$audio_file" ]; then
            echo "❌ File not found: $audio_file"
            exit 1
        fi
        clone_voice "sarah" "$audio_file" "Professional female SDR voice - friendly and engaging"
        ;;
    3)
        read -p "Voice ID (e.g., custom_voice_1): " voice_id
        read -p "Path to voice sample (WAV file): " audio_file
        read -p "Description: " description
        
        if [ ! -f "$audio_file" ]; then
            echo "❌ File not found: $audio_file"
            exit 1
        fi
        
        clone_voice "$voice_id" "$audio_file" "$description"
        ;;
    4)
        echo "📋 Existing voices:"
        curl -s "$CHATTERBOX_URL/voices" | python3 -m json.tool
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "🎉 Voice cloning complete!"
echo ""
echo "Next steps:"
echo "1. Update backend/.env:"
echo "   USE_CHATTERBOX=true"
echo "   CHATTERBOX_VOICE_MALE=$voice_id"
echo "2. Restart your backend server"
echo "3. Make a test call to hear the new voice!"
