# Quick Start Guide

## Your Situation: macOS Development

You're on macOS without NVIDIA GPU. Here are your **3 practical options**:

---

## ✅ Option 1: Test Locally (CPU - Slow but Works)

**Best for:** Quick testing and development  
**Performance:** 2-5 seconds per synthesis (slow)  
**Cost:** Free

```bash
cd chatterbox-tts-service

# Start CPU version
docker compose -f docker-compose.cpu.yml up -d

# Check logs (wait for "✅ Chatterbox TTS ready!")
docker compose -f docker-compose.cpu.yml logs -f

# Test it
curl http://localhost:8001/health
```

**Then enable in backend:**
```bash
# Edit backend/.env
USE_CHATTERBOX=true
CHATTERBOX_TTS_URL=http://localhost:8001

# Restart backend
cd ../backend
npm run dev
```

---

## 🚀 Option 2: Deploy to AWS (GPU - Fast & Production)

**Best for:** Production use  
**Performance:** <200ms per synthesis  
**Cost:** ~$150/month (reserved instance)

### Quick AWS Setup:

1. **Launch EC2 Instance:**
   - Instance type: `g4dn.xlarge`
   - AMI: Deep Learning AMI (Ubuntu 22.04)
   - Storage: 50GB
   - Security group: Allow ports 22, 8001

2. **SSH and Deploy:**
   ```bash
   ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP
   
   # Clone repo
   git clone https://github.com/your-username/ai-sdr-outbound.git
   cd ai-sdr-outbound/chatterbox-tts-service
   
   # Start service
   docker compose up -d
   
   # Check logs
   docker compose logs -f
   ```

3. **Update Backend:**
   ```bash
   # Edit backend/.env on your local machine
   USE_CHATTERBOX=true
   CHATTERBOX_TTS_URL=http://YOUR_INSTANCE_IP:8001
   ```

See `AWS_DEPLOYMENT.md` for detailed instructions.

---

## 💡 Option 3: Keep ElevenLabs (No Changes)

**Best for:** If you want to wait  
**Performance:** <200ms per synthesis  
**Cost:** $450/month

```bash
# backend/.env
USE_CHATTERBOX=false  # Keep using ElevenLabs
```

No changes needed. Deploy Chatterbox later when ready.

---

## 🎤 Voice Cloning (After Deployment)

Once Chatterbox is running (local or AWS):

### 1. Prepare Voice Samples

Record 5-10 second samples:
- **Alex (male):** Professional, warm, confident
- **Sarah (female):** Friendly, engaging, professional

**Requirements:**
- Format: WAV, 16kHz or 24kHz, mono
- Quality: Clear, no background noise
- Content: Natural speaking, conversational

### 2. Clone Voices

```bash
cd chatterbox-tts-service

# Make script executable
chmod +x setup-voices.sh

# Run interactive setup
./setup-voices.sh

# Or manually:
curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=alex" \
  -F "audio_file=@alex_sample.wav" \
  -F "description=Professional male SDR voice"

curl -X POST http://localhost:8001/clone-voice \
  -F "voice_id=sarah" \
  -F "audio_file=@sarah_sample.wav" \
  -F "description=Professional female SDR voice"
```

### 3. Update Backend

```bash
# Edit backend/.env
CHATTERBOX_VOICE_MALE=alex
CHATTERBOX_VOICE_FEMALE=sarah

# Restart backend
cd ../backend
npm run dev
```

---

## 🧪 Testing

### Test Chatterbox Service

```bash
cd chatterbox-tts-service
chmod +x test-tts.sh
./test-tts.sh
```

### Test Backend Integration

```bash
# Make a test call through your app
# Listen for voice quality
# Check backend logs for [Chatterbox] messages
```

### Compare Quality

1. Make 5 calls with `USE_CHATTERBOX=true`
2. Make 5 calls with `USE_CHATTERBOX=false` (ElevenLabs)
3. Compare quality, latency, naturalness

---

## 📊 Decision Matrix

| Factor | Local CPU | AWS GPU | ElevenLabs |
|--------|-----------|---------|------------|
| Speed | ❌ Slow (2-5s) | ✅ Fast (<200ms) | ✅ Fast (<200ms) |
| Cost | ✅ Free | ✅ $150/mo | ❌ $450/mo |
| Quality | ✅ Good | ✅ Excellent | ✅ Excellent |
| Setup | ✅ 5 min | ⚠️ 15 min | ✅ Already done |
| Production Ready | ❌ No | ✅ Yes | ✅ Yes |

---

## 🎯 Recommended Path

**For You (100 calls/day):**

1. **Today:** Test locally with CPU version
   - Verify integration works
   - Test voice cloning
   - Check quality

2. **This Week:** Deploy to AWS
   - Launch g4dn.xlarge instance
   - Deploy Chatterbox with GPU
   - Switch backend to AWS endpoint

3. **Result:** Save $300/month with same quality

---

## 🆘 Need Help?

**Service won't start:**
```bash
docker compose logs chatterbox-tts
```

**Can't connect from backend:**
```bash
curl http://localhost:8001/health
```

**AWS deployment issues:**
See `AWS_DEPLOYMENT.md` for detailed troubleshooting

**Voice cloning questions:**
See `README.md` for best practices
