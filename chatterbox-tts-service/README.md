# Chatterbox TTS Microservice

High-performance, open-source TTS service that replaces ElevenLabs with zero-shot voice cloning and ultra-low latency.

## Features

- ✅ **Ultra-low latency** (<200ms) - perfect for real-time calls
- ✅ **Zero-shot voice cloning** - clone any voice with 3-10 seconds of audio
- ✅ **Emotion control** - adjustable expressiveness (0.0 to 1.0)
- ✅ **Multiple output formats** - MP3, WAV, μ-law (Twilio compatible)
- ✅ **Voice management** - upload, list, and delete voice profiles
- ✅ **GPU accelerated** - CUDA support for fast inference
- ✅ **RESTful API** - easy integration with existing systems

## Quick Start

### Prerequisites

- Docker & Docker Compose
- NVIDIA GPU with CUDA support (recommended)
- At least 8GB VRAM

### Installation

```bash
# Navigate to the service directory
cd chatterbox-tts-service

# Build and start the service
docker-compose up -d

# Check logs
docker-compose logs -f

# Test the service
curl http://localhost:8001/health
```

### Without Docker (Local Development)

```bash
# Install dependencies
pip install -r requirements.txt
pip install chatterbox-tts torch torchaudio

# Run the service
python app.py
```

## API Endpoints

### 1. Health Check
```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cuda",
  "cuda_available": true
}
```

### 2. Synthesize Speech
```bash
POST /synthesize
Content-Type: application/json

{
  "text": "Hey, this is Alex from Atomicwork. How's it going?",
  "voice_id": "alex",
  "exaggeration": 0.5,
  "cfg_weight": 0.5,
  "output_format": "mp3"
}
```

**Parameters:**
- `text` (required): Text to synthesize
- `voice_id` (optional): Voice profile ID (default: "default")
- `audio_prompt_path` (optional): Direct path to voice sample
- `exaggeration` (optional): Emotion intensity 0.0-1.0 (default: 0.5)
- `cfg_weight` (optional): Voice consistency 0.0-1.0 (default: 0.5)
- `output_format` (optional): "mp3", "wav", or "ulaw" (default: "mp3")

**Response:** Audio file (MP3/WAV/μ-law)

### 3. Clone Voice
```bash
POST /clone-voice
Content-Type: multipart/form-data

voice_id: alex
audio_file: @alex_voice_sample.wav
description: "Warm, professional male voice"
```

**Response:**
```json
{
  "status": "success",
  "voice_id": "alex",
  "description": "Warm, professional male voice",
  "file_path": "/app/voices/alex.wav"
}
```

### 4. List Voices
```bash
GET /voices
```

**Response:**
```json
{
  "voices": ["alex", "sarah", "custom_voice_1"],
  "default_voice": "default"
}
```

### 5. Delete Voice
```bash
DELETE /voices/{voice_id}
```

## Integration with Your AI SDR

### Step 1: Update Backend Environment

Add to `backend/.env`:
```bash
# Chatterbox TTS Service
CHATTERBOX_TTS_URL=http://localhost:8001
USE_CHATTERBOX=true
```

### Step 2: Create TTS Client

Create `backend/chatterboxClient.js`:
```javascript
import fetch from 'node-fetch';

const CHATTERBOX_URL = process.env.CHATTERBOX_TTS_URL || 'http://localhost:8001';

export async function synthesizeWithChatterbox(text, voiceId = 'default', options = {}) {
  const {
    exaggeration = 0.5,
    cfg_weight = 0.5,
    output_format = 'mp3'
  } = options;

  const response = await fetch(`${CHATTERBOX_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      exaggeration,
      cfg_weight,
      output_format
    })
  });

  if (!response.ok) {
    throw new Error(`Chatterbox TTS failed: ${response.status}`);
  }

  return await response.arrayBuffer();
}

export async function cloneVoice(voiceId, audioFilePath, description) {
  const FormData = (await import('form-data')).default;
  const fs = (await import('fs')).default;
  
  const formData = new FormData();
  formData.append('voice_id', voiceId);
  formData.append('audio_file', fs.createReadStream(audioFilePath));
  if (description) formData.append('description', description);

  const response = await fetch(`${CHATTERBOX_URL}/clone-voice`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Voice cloning failed: ${response.status}`);
  }

  return await response.json();
}
```

### Step 3: Update server.js

Replace ElevenLabs calls with Chatterbox:

```javascript
import { synthesizeWithChatterbox } from './chatterboxClient.js';

// Replace synthesizeWithElevenLabs function
export async function synthesizeWithChatterbox(text, callSid) {
  const voiceId = getVoiceIdForCall(callSid);
  
  console.log(`[Chatterbox] Synthesizing for ${callSid}:`, text);

  const audioBuffer = await synthesizeWithChatterbox(text, voiceId, {
    exaggeration: 0.5,
    cfg_weight: 0.5,
    output_format: 'mp3'
  });

  const filename = `${callSid}_${Date.now()}.mp3`;
  const filepath = path.join(TTS_DIR, filename);
  
  fs.writeFileSync(filepath, Buffer.from(audioBuffer));
  
  const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;
  console.log(`[Chatterbox] Audio ready: ${publicUrl}`);
  
  return publicUrl;
}
```

## Voice Cloning Guide

### Creating Voice Profiles

1. **Record a clean voice sample** (3-10 seconds)
   - Clear audio, no background noise
   - Natural speaking pace
   - Representative of desired voice

2. **Upload the voice sample:**
```bash
curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=alex" \
  -F "audio_file=@alex_sample.wav" \
  -F "description=Professional male SDR voice"
```

3. **Use the cloned voice:**
```bash
curl -X POST http://localhost:8001/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hey, this is Alex from Atomicwork!",
    "voice_id": "alex"
  }' \
  --output test.mp3
```

### Best Practices

**For SDR Calls:**
- `exaggeration: 0.5-0.7` - Natural to slightly expressive
- `cfg_weight: 0.3-0.5` - Balanced pacing

**For Dramatic/Emotional:**
- `exaggeration: 0.7-1.0` - Very expressive
- `cfg_weight: 0.2-0.3` - Faster, more dynamic

**For Calm/Professional:**
- `exaggeration: 0.3-0.5` - Subdued
- `cfg_weight: 0.5-0.7` - Slower, more deliberate

## Performance Tuning

### GPU Memory Optimization

If running out of VRAM:
```python
# In app.py, add before model loading:
torch.cuda.empty_cache()
torch.backends.cudnn.benchmark = True
```

### Batch Processing

For multiple TTS requests, consider implementing a queue system to batch process requests.

### Caching

Implement response caching for frequently used phrases:
```python
# Add to app.py
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_generate(text, voice_id):
    # Cache generated audio
    pass
```

## Monitoring

### Check Service Status
```bash
docker-compose ps
docker-compose logs -f chatterbox-tts
```

### GPU Usage
```bash
nvidia-smi -l 1
```

### API Metrics
```bash
# Add prometheus metrics endpoint
curl http://localhost:8001/metrics
```

## Troubleshooting

### Model Not Loading
```bash
# Check CUDA availability
docker exec -it chatterbox-tts-service python3 -c "import torch; print(torch.cuda.is_available())"

# Check disk space for model cache
df -h
```

### Slow Inference
- Ensure GPU is being used (check logs for "cuda")
- Reduce batch size if processing multiple requests
- Check GPU memory: `nvidia-smi`

### Audio Quality Issues
- Increase `cfg_weight` for more stable output
- Use higher quality voice samples (16kHz+, mono, WAV)
- Adjust `exaggeration` based on use case

## Cost Comparison

### ElevenLabs (Current)
- ~$0.30 per 1,000 characters
- 100 calls/day × 500 words = **$450/month**

### Chatterbox (Self-Hosted)
- GPU server: ~$150/month (AWS g4dn.xlarge)
- **Total: $150/month (67% savings)**

## Next Steps

1. ✅ Deploy Chatterbox service
2. ⏳ Clone your SDR voices (Alex, Sarah, etc.)
3. ⏳ Update backend to use Chatterbox
4. ⏳ Test voice quality on sample calls
5. ⏳ Monitor performance and costs

## Support

- GitHub Issues: [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox)
- Discord: [Resemble AI Community](https://discord.gg/resemble)
- Documentation: [Chatterbox Docs](https://github.com/resemble-ai/chatterbox)
