# Local Development Setup (macOS)

Since you're on macOS without NVIDIA GPU, here are your options:

## Option 1: CPU-Only Local Testing (Slower but Works)

**Performance:** ~2-5 seconds per synthesis (vs <200ms on GPU)  
**Use Case:** Development and testing only

```bash
cd chatterbox-tts-service

# Build and start CPU version
docker compose -f docker-compose.cpu.yml up -d

# Check logs
docker compose -f docker-compose.cpu.yml logs -f

# Wait for "✅ Chatterbox TTS ready!" message
```

**Note:** CPU inference is 10-20x slower than GPU. Fine for testing, not for production.

---

## Option 2: AWS GPU Instance (Recommended for Production)

**Performance:** <200ms per synthesis  
**Cost:** ~$150-200/month (g4dn.xlarge reserved)

### Quick AWS Deployment

```bash
# 1. Launch EC2 instance
# - Instance type: g4dn.xlarge
# - AMI: Deep Learning AMI (Ubuntu 22.04)
# - Storage: 50GB
# - Security group: Allow 8001, 22

# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# 3. Clone and deploy
git clone <your-repo>
cd ai-sdr-outbound/chatterbox-tts-service
docker compose up -d

# 4. Update backend/.env
CHATTERBOX_TTS_URL=http://your-instance-ip:8001
```

---

## Option 3: Use ElevenLabs for Now

Keep using ElevenLabs while you set up AWS:

```bash
# backend/.env
USE_CHATTERBOX=false  # Keep using ElevenLabs
```

Deploy Chatterbox to AWS when ready, then switch:

```bash
# backend/.env
USE_CHATTERBOX=true
CHATTERBOX_TTS_URL=http://your-aws-instance:8001
```

---

## Recommended Approach

**For immediate testing:**
1. Start CPU version locally (slow but works)
2. Test voice cloning and quality
3. Verify integration works

**For production:**
1. Deploy to AWS g4dn.xlarge
2. Switch backend to use AWS endpoint
3. Enjoy fast, cost-effective TTS

---

## Next Steps

Choose your path:

**A) Test locally (CPU):**
```bash
cd chatterbox-tts-service
docker compose -f docker-compose.cpu.yml up -d
```

**B) Deploy to AWS (GPU):**
Follow `AWS_DEPLOYMENT.md` guide

**C) Stick with ElevenLabs:**
No changes needed, keep current setup
