# Chatterbox TTS Deployment Guide

Complete guide to deploy and integrate Chatterbox TTS as a cost-effective replacement for ElevenLabs.

## 🎯 Overview

**Current Setup:** OpenAI Realtime (ASR + LLM) + ElevenLabs (TTS)  
**New Setup:** OpenAI Realtime (ASR + LLM) + Chatterbox (TTS)  
**Cost Savings:** ~67% reduction in TTS costs ($450/month → $150/month)

## 📋 Prerequisites

- Docker & Docker Compose installed
- NVIDIA GPU with CUDA support (8GB+ VRAM recommended)
- NVIDIA Container Toolkit installed
- Your backend server running on port 4000
- Ngrok or similar for public URL

## 🚀 Quick Start (5 Minutes)

### Step 1: Start Chatterbox Service

```bash
cd chatterbox-tts-service

# Build and start the service
docker-compose up -d

# Check logs
docker-compose logs -f chatterbox-tts

# Wait for "✅ Chatterbox TTS ready!" message
```

### Step 2: Verify Service Health

```bash
# Check health endpoint
curl http://localhost:8001/health

# Expected response:
# {
#   "status": "healthy",
#   "model_loaded": true,
#   "device": "cuda",
#   "cuda_available": true
# }
```

### Step 3: Enable Chatterbox in Backend

Edit `backend/.env`:
```bash
# Change this line:
USE_CHATTERBOX=false

# To:
USE_CHATTERBOX=true
```

### Step 4: Restart Backend

```bash
cd backend
npm run dev
```

### Step 5: Test!

Make a test call and listen to the new voice quality. The system will automatically use Chatterbox instead of ElevenLabs.

---

## 🎤 Voice Cloning (Optional but Recommended)

### Why Clone Voices?

- Match your brand's voice identity
- Create consistent SDR personas (Alex, Sarah, etc.)
- Better emotional range and naturalness

### Quick Voice Clone

```bash
cd chatterbox-tts-service

# Make setup script executable
chmod +x setup-voices.sh

# Run interactive setup
./setup-voices.sh
```

### Manual Voice Clone

```bash
# Clone Alex (male voice)
curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=alex" \
  -F "audio_file=@alex_sample.wav" \
  -F "description=Professional male SDR voice"

# Clone Sarah (female voice)
curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=sarah" \
  -F "audio_file=@sarah_sample.wav" \
  -F "description=Professional female SDR voice"
```

### Voice Sample Requirements

- **Format:** WAV (16kHz or 24kHz, mono preferred)
- **Duration:** 3-10 seconds
- **Quality:** Clear audio, no background noise
- **Content:** Natural speaking, representative of desired style
- **Emotion:** Match the tone you want for calls (professional, friendly, etc.)

### Update Voice IDs in Backend

After cloning, update `backend/.env`:
```bash
CHATTERBOX_VOICE_MALE=alex
CHATTERBOX_VOICE_FEMALE=sarah
```

---

## 🔧 Advanced Configuration

### Emotion & Expressiveness Control

Edit `backend/server.js` to adjust TTS parameters:

```javascript
const audioBuffer = await chatterboxSynthesize(text, voiceId, {
  exaggeration: 0.5,  // 0.0-1.0 (emotion intensity)
  cfg_weight: 0.5,    // 0.0-1.0 (voice consistency)
  output_format: "mp3"
});
```

**Recommended Settings by Use Case:**

| Use Case | exaggeration | cfg_weight | Description |
|----------|--------------|------------|-------------|
| Professional SDR | 0.5 | 0.5 | Balanced, natural |
| Enthusiastic Sales | 0.7 | 0.3 | Expressive, dynamic |
| Calm Support | 0.3 | 0.7 | Subdued, deliberate |
| Urgent/Dramatic | 0.8-1.0 | 0.2-0.3 | Very expressive |

### GPU Memory Optimization

If running out of VRAM, edit `chatterbox-tts-service/app.py`:

```python
@app.on_event("startup")
async def startup_event():
    global model
    torch.cuda.empty_cache()  # Clear cache
    torch.backends.cudnn.benchmark = True  # Optimize
    model = ChatterboxTTS.from_pretrained(device=DEVICE)
```

### Multiple Voice Profiles

Create different voices for different scenarios:

```bash
# Clone multiple voices
curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=alex_professional" \
  -F "audio_file=@alex_formal.wav"

curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=alex_casual" \
  -F "audio_file=@alex_friendly.wav"

# Use in code
const audioBuffer = await chatterboxSynthesize(
  text, 
  "alex_professional",  // or "alex_casual"
  options
);
```

---

## 📊 Performance Monitoring

### Check Service Status

```bash
# Docker status
docker-compose ps

# Live logs
docker-compose logs -f chatterbox-tts

# GPU usage
nvidia-smi -l 1
```

### API Metrics

```bash
# Test synthesis speed
time curl -X POST http://localhost:8001/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hey, this is Alex from Atomicwork. How are you doing today?"}' \
  --output test.mp3

# Expected: <200ms for short sentences
```

### Monitor Backend Logs

```bash
cd backend
npm run dev

# Look for:
# [Chatterbox] Synthesizing (Male) for CA123...
# [Chatterbox] Audio ready at: https://...
```

---

## 🐛 Troubleshooting

### Issue: Service Won't Start

**Symptoms:** Docker container exits immediately

**Solutions:**
```bash
# Check CUDA availability
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi

# Check logs
docker-compose logs chatterbox-tts

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Issue: Model Not Loading

**Symptoms:** "Model not loaded" error

**Solutions:**
```bash
# Check disk space (models are ~2GB)
df -h

# Check cache directory
docker exec -it chatterbox-tts-service ls -lh /root/.cache

# Clear cache and restart
docker-compose down -v
docker-compose up -d
```

### Issue: Slow Inference

**Symptoms:** TTS takes >1 second

**Solutions:**
1. Verify GPU is being used:
   ```bash
   docker exec -it chatterbox-tts-service python3 -c "import torch; print(torch.cuda.is_available())"
   ```

2. Check GPU memory:
   ```bash
   nvidia-smi
   ```

3. Reduce concurrent requests or scale horizontally

### Issue: Poor Audio Quality

**Solutions:**
1. Use higher quality voice samples (16kHz+, WAV format)
2. Adjust `cfg_weight` (higher = more stable, lower = more dynamic)
3. Re-clone voice with better sample
4. Adjust `exaggeration` based on use case

### Issue: Backend Can't Connect

**Symptoms:** "Chatterbox TTS failed" errors in backend logs

**Solutions:**
```bash
# Check if service is accessible
curl http://localhost:8001/health

# Check Docker network
docker network ls
docker network inspect chatterbox-tts-service_default

# Update backend .env if needed
CHATTERBOX_TTS_URL=http://localhost:8001
```

---

## 🔄 Switching Between ElevenLabs and Chatterbox

You can easily switch between providers without code changes:

### Use Chatterbox (Open-Source)
```bash
# backend/.env
USE_CHATTERBOX=true
```

### Use ElevenLabs (Paid)
```bash
# backend/.env
USE_CHATTERBOX=false
```

### A/B Testing

Run both and compare:
1. Make 10 calls with `USE_CHATTERBOX=true`
2. Make 10 calls with `USE_CHATTERBOX=false`
3. Compare quality, latency, and cost

---

## 💰 Cost Analysis

### Current Costs (ElevenLabs)

- **TTS:** $0.30 per 1,000 characters
- **Volume:** 100 calls/day × 500 words avg = 50,000 chars/day
- **Monthly:** 50K × 30 days = 1.5M characters
- **Cost:** 1,500 × $0.30 = **$450/month**

### New Costs (Chatterbox)

- **TTS:** Free (open-source)
- **GPU Server:** AWS g4dn.xlarge = $0.526/hour
- **Monthly:** $0.526 × 24 × 30 = **$378/month**
- **With Reserved Instance:** ~**$150-200/month** (60% savings)

### Break-Even Analysis

- **Chatterbox becomes cheaper at:** ~50 calls/day
- **Your volume:** 100 calls/day
- **Savings:** **$250-300/month** (55-67%)

---

## 🚀 Production Deployment

### AWS Deployment (Recommended)

**Instance Type:** g4dn.xlarge
- 4 vCPUs
- 16 GB RAM
- 1 NVIDIA T4 GPU (16GB VRAM)
- Cost: ~$150-200/month (reserved)

**Setup:**
```bash
# Install NVIDIA drivers
sudo apt-get update
sudo apt-get install -y nvidia-driver-535

# Install Docker & NVIDIA Container Toolkit
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Deploy Chatterbox
git clone <your-repo>
cd chatterbox-tts-service
docker-compose up -d
```

### Scaling Horizontally

For high volume (500+ calls/day):

```yaml
# docker-compose.yml
version: '3.8'
services:
  chatterbox-tts-1:
    build: .
    ports: ["8001:8001"]
    # ... GPU config
  
  chatterbox-tts-2:
    build: .
    ports: ["8002:8001"]
    # ... GPU config
  
  nginx:
    image: nginx:alpine
    ports: ["8000:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Load Balancer Config

```nginx
# nginx.conf
upstream chatterbox {
    least_conn;
    server chatterbox-tts-1:8001;
    server chatterbox-tts-2:8001;
}

server {
    listen 80;
    location / {
        proxy_pass http://chatterbox;
    }
}
```

---

## 📈 Next Steps

1. ✅ **Deploy Chatterbox** - Follow Quick Start
2. ⏳ **Clone Voices** - Create Alex & Sarah profiles
3. ⏳ **Test Quality** - Make 10 test calls
4. ⏳ **Monitor Performance** - Check latency & GPU usage
5. ⏳ **Optimize Settings** - Tune exaggeration & cfg_weight
6. ⏳ **Production Deploy** - Move to AWS if satisfied

---

## 🆘 Support

- **GitHub Issues:** [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox/issues)
- **Discord:** [Resemble AI Community](https://discord.gg/resemble)
- **Documentation:** [Chatterbox Docs](https://github.com/resemble-ai/chatterbox)

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Chatterbox TTS microservice
- ✅ Docker deployment
- ✅ Voice cloning support
- ✅ Auto-switching between ElevenLabs/Chatterbox
- ✅ MP3, WAV, μ-law output formats
- ✅ GPU acceleration
- ✅ RESTful API

### Roadmap
- [ ] Real-time streaming TTS
- [ ] Voice mixing (blend multiple voices)
- [ ] Emotion presets (happy, sad, excited, etc.)
- [ ] Multi-language support (23 languages)
- [ ] Prometheus metrics endpoint
- [ ] Kubernetes deployment manifests
