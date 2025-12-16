# Local TTS Testing Service

Quick local TTS service for testing integration before AWS deployment.

## ⚠️ Important

This is a **testing-only** service using macOS system voices. Quality is basic.

**For production:** Deploy XTTS-v2 or Chatterbox to AWS (see `../AWS_PRODUCTION_DEPLOYMENT.md`)

## Quick Start

```bash
cd local-tts-service

# Install dependencies
pip install -r requirements.txt

# Install ffmpeg (required for audio conversion)
brew install ffmpeg

# Start service
python app.py
```

Service will run on `http://localhost:8001`

## Test It

```bash
# Health check
curl http://localhost:8001/health

# Synthesize speech
curl -X POST http://localhost:8001/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hey, this is Alex from Atomicwork. How are you doing today?"}' \
  --output test.mp3

# Play it
open test.mp3
```

## Integrate with Backend

```bash
# Edit backend/.env
USE_CHATTERBOX=true
CHATTERBOX_TTS_URL=http://localhost:8001

# Restart backend
cd ../backend
npm run dev
```

## Limitations

- ❌ Basic quality (system voices)
- ❌ No voice cloning
- ❌ Slower than cloud TTS
- ❌ Not production-ready

## Next Steps

After testing locally:
1. Verify integration works
2. Make test call
3. Deploy to AWS for production quality
