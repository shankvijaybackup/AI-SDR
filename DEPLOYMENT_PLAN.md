# TTS Deployment Plan - Test & Production

## 🎯 Current Situation

You're on macOS (Apple Silicon) which limits local TTS testing options. Here's the practical path forward:

---

## ✅ Phase 1: Keep ElevenLabs While Setting Up AWS (Today)

**Action:** No changes to current setup

```bash
# backend/.env (keep as is)
USE_CHATTERBOX=false
```

**Why:** Your current setup works. Focus on AWS deployment for production-quality open-source TTS.

---

## 🚀 Phase 2: Deploy to AWS Production (This Week)

### Option A: XTTS-v2 (Easier, Proven)

**Setup Time:** 20 minutes  
**Quality:** ⭐⭐⭐⭐ (very good)  
**Cost:** $150/month  
**Savings:** $300/month

```bash
# 1. Launch AWS EC2 g4dn.xlarge
# 2. SSH and run:

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Deploy XTTS-v2
git clone https://github.com/coqui-ai/xtts-streaming-server.git
cd xtts-streaming-server
docker compose up -d

# Test
curl http://localhost:8000/health
```

**Then update your backend:**
```bash
# backend/.env
USE_XTTS=true
XTTS_URL=http://YOUR_AWS_IP:8000/tts
```

---

### Option B: Chatterbox (Best Quality)

**Setup Time:** 30 minutes  
**Quality:** ⭐⭐⭐⭐⭐ (beats ElevenLabs)  
**Cost:** $150/month  
**Savings:** $300/month

```bash
# 1. Launch AWS EC2 g4dn.xlarge
# 2. SSH and run:

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3-pip git ffmpeg

# Clone and install Chatterbox
git clone https://github.com/resemble-ai/chatterbox.git
cd chatterbox
pip install -e .
pip install fastapi uvicorn python-multipart aiofiles

# Copy our FastAPI wrapper
# (Use the app.py from chatterbox-tts-service/)

# Run service
python app.py
```

**Then update your backend:**
```bash
# backend/.env
USE_CHATTERBOX=true
CHATTERBOX_TTS_URL=http://YOUR_AWS_IP:8001
```

---

## 📋 Detailed AWS Setup Steps

### 1. Launch EC2 Instance

**Via AWS Console:**
1. Go to EC2 → Launch Instance
2. **Name:** `ai-sdr-tts-service`
3. **AMI:** Deep Learning AMI (Ubuntu 22.04) - `ami-0c7217cdde317cfec`
4. **Instance type:** `g4dn.xlarge`
5. **Key pair:** Create or select existing
6. **Security group:** 
   - Allow SSH (22) from your IP
   - Allow 8000-8001 from your backend IP
7. **Storage:** 50GB gp3
8. **Launch**

### 2. Configure Security Group

```bash
# Allow TTS service port
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0  # Restrict to your backend IP in production
```

### 3. SSH and Verify GPU

```bash
ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP

# Check GPU
nvidia-smi

# Should show NVIDIA T4 GPU
```

### 4. Deploy TTS Service

Choose Option A (XTTS-v2) or Option B (Chatterbox) from above.

### 5. Test Service

```bash
# From your local machine
curl http://YOUR_INSTANCE_IP:8000/health  # XTTS-v2
# or
curl http://YOUR_INSTANCE_IP:8001/health  # Chatterbox
```

### 6. Update Backend

```bash
# On your local machine, edit backend/.env
USE_XTTS=true  # or USE_CHATTERBOX=true
XTTS_URL=http://YOUR_INSTANCE_IP:8000/tts
# or
CHATTERBOX_TTS_URL=http://YOUR_INSTANCE_IP:8001

# Restart backend
cd backend
npm run dev
```

### 7. Make Test Call

Make a call through your app and verify:
- ✅ Voice quality is good
- ✅ Latency is acceptable (<500ms)
- ✅ No errors in backend logs

---

## 🎤 Voice Cloning (After AWS Deployment)

### For XTTS-v2:

```bash
# Upload voice sample
curl -X POST http://YOUR_INSTANCE_IP:8000/clone-voice \
  -F "voice_name=alex" \
  -F "audio_file=@alex_sample.wav"

# Use cloned voice
curl -X POST http://YOUR_INSTANCE_IP:8000/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hey, this is Alex from Atomicwork!",
    "voice": "alex"
  }' \
  --output test.mp3
```

### For Chatterbox:

```bash
# Upload voice sample
curl -X POST http://YOUR_INSTANCE_IP:8001/clone-voice \
  -F "voice_id=alex" \
  -F "audio_file=@alex_sample.wav" \
  -F "description=Professional male SDR voice"

# Use cloned voice
curl -X POST http://YOUR_INSTANCE_IP:8001/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hey, this is Alex from Atomicwork!",
    "voice_id": "alex"
  }' \
  --output test.mp3
```

---

## 💰 Cost Breakdown

### Current (ElevenLabs):
- TTS: $450/month
- **Total: $450/month**

### New (AWS + Open-Source TTS):
- EC2 g4dn.xlarge on-demand: $378/month
- EC2 g4dn.xlarge reserved (1-year): $150/month
- **Total: $150-378/month**
- **Savings: $72-300/month**

### Break-Even:
At your volume (100 calls/day), AWS becomes cheaper immediately.

---

## 🎯 Recommended Timeline

**Today:**
- [x] Understand deployment options
- [ ] Choose: XTTS-v2 or Chatterbox
- [ ] Launch AWS EC2 instance

**Tomorrow:**
- [ ] Deploy chosen TTS service
- [ ] Test synthesis quality
- [ ] Update backend configuration

**This Week:**
- [ ] Make test calls
- [ ] Record voice samples (Alex & Sarah)
- [ ] Clone voices
- [ ] Switch production traffic

**Result:** $300/month savings with same or better quality

---

## 🆘 Need Help?

**AWS Setup Issues:**
- Check security group allows port 8000/8001
- Verify GPU with `nvidia-smi`
- Check Docker logs: `docker compose logs -f`

**TTS Quality Issues:**
- Try both XTTS-v2 and Chatterbox
- Adjust voice settings
- Use better voice samples for cloning

**Backend Integration:**
- Verify TTS service is reachable
- Check backend logs for errors
- Test with curl first before full integration

---

## 📚 Resources

- **XTTS-v2:** https://github.com/coqui-ai/xtts-streaming-server
- **Chatterbox:** https://github.com/resemble-ai/chatterbox
- **AWS EC2 Pricing:** https://aws.amazon.com/ec2/pricing/
- **Our Integration Code:** `backend/chatterboxClient.js`, `backend/server.js`
