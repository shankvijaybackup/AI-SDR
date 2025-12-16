# Voice Cloning Guide - Record Your Voice for AI SDR

Perfect! Let's clone your voice to get natural, human emotion in your AI SDR calls.

## 🎤 Step 1: Record Your Voice Sample

### What to Record

Record **5-10 seconds** of natural speaking. Here's a sample script:

```
"Hey, this is Alex from Atomicwork. How's it going? 
I wanted to reach out because I noticed your team might be 
dealing with some IT service management challenges. 
We've helped companies like yours streamline their workflows 
and reduce ticket resolution time by up to 60%. 
Would love to chat for a few minutes if you're open to it."
```

### Recording Tips

✅ **DO:**
- Speak naturally and conversationally
- Use your normal phone voice (warm, professional)
- Include natural pauses and breathing
- Show emotion (friendly, confident, engaging)
- Record in a quiet room
- Use your phone or laptop mic (built-in is fine)

❌ **DON'T:**
- Read robotically
- Speak too fast or too slow
- Include background noise
- Use overly formal language
- Record in echo-y spaces

### Recording Options

**Option A: QuickTime (Mac)**
1. Open QuickTime Player
2. File → New Audio Recording
3. Click red record button
4. Speak naturally for 5-10 seconds
5. Stop recording
6. File → Save as `alex_voice_sample.wav`

**Option B: Voice Memos (iPhone)**
1. Open Voice Memos app
2. Tap red record button
3. Speak naturally for 5-10 seconds
4. Tap stop
5. Share → Save to Files as `alex_voice_sample.m4a`

**Option C: Online Recorder**
- Use https://online-voice-recorder.com/
- Record → Download as WAV

### File Requirements

- **Format:** WAV or M4A (we'll convert if needed)
- **Duration:** 5-10 seconds
- **Quality:** Clear, no background noise
- **Size:** Usually 500KB - 2MB

---

## 🚀 Step 2: Deploy AWS with Voice Cloning

Once you have your voice sample, we'll deploy XTTS-v2 to AWS which supports voice cloning.

### Quick AWS Setup (20 minutes)

**1. Launch EC2 Instance:**
```bash
# Instance type: g4dn.xlarge
# AMI: Deep Learning AMI (Ubuntu 22.04)
# Storage: 50GB
# Security group: Allow ports 22, 8000
```

**2. SSH and Deploy XTTS-v2:**
```bash
ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP

# Install Docker + NVIDIA toolkit
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Verify GPU
nvidia-smi

# Deploy XTTS-v2
git clone https://github.com/coqui-ai/xtts-streaming-server.git
cd xtts-streaming-server
docker compose up -d

# Check logs
docker compose logs -f
```

**3. Test Service:**
```bash
curl http://localhost:8000/health
```

---

## 🎯 Step 3: Clone Your Voice

**Upload your voice sample to AWS:**

```bash
# From your local machine
scp -i your-key.pem alex_voice_sample.wav ubuntu@YOUR_INSTANCE_IP:~/

# SSH into AWS
ssh -i your-key.pem ubuntu@YOUR_INSTANCE_IP

# Clone voice
curl -X POST http://localhost:8000/clone-voice \
  -F "voice_name=alex" \
  -F "audio_file=@alex_voice_sample.wav"
```

**Test your cloned voice:**

```bash
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hey, this is Alex from Atomicwork. How are you doing today?",
    "voice": "alex",
    "language": "en"
  }' \
  --output test_cloned.wav

# Download and listen
scp -i your-key.pem ubuntu@YOUR_INSTANCE_IP:~/test_cloned.wav .
open test_cloned.wav
```

---

## 🔧 Step 4: Update Backend

**Edit `backend/.env`:**

```bash
# Switch to XTTS-v2 with your cloned voice
USE_XTTS=true
XTTS_URL=http://YOUR_AWS_IP:8000/tts
XTTS_VOICE_MALE=alex  # Your cloned voice
XTTS_VOICE_FEMALE=alex  # Or clone a female voice too
```

**Update backend to use XTTS:**

We need to add XTTS support to your backend. I'll create the integration.

---

## 📊 Expected Results

**Before (gTTS):**
- ❌ Robotic, no emotion
- ❌ Generic voice
- ❌ Not engaging

**After (Your Cloned Voice):**
- ✅ Natural, human emotion
- ✅ Your actual voice personality
- ✅ Warm, engaging, professional
- ✅ Sounds like a real SDR call

---

## 💰 Cost

**AWS g4dn.xlarge:**
- On-demand: $0.526/hour (~$378/month)
- Reserved (1-year): ~$150/month
- **Savings vs ElevenLabs: $300/month**

---

## 🎤 Multiple Voices (Optional)

You can clone multiple voices for different personas:

**Alex (Male SDR):**
- Your voice
- Professional, confident, warm

**Sarah (Female SDR):**
- Record a female colleague
- Friendly, engaging, professional

**Manager (Follow-up):**
- Record a manager voice
- Authoritative, helpful

---

## 🚀 Next Steps

**Right Now:**
1. ✅ Record your voice sample (5-10 seconds)
2. ⏳ Save as `alex_voice_sample.wav`
3. ⏳ Let me know when ready

**Then I'll Help You:**
1. Launch AWS EC2 instance
2. Deploy XTTS-v2 with GPU
3. Clone your voice
4. Update backend integration
5. Test with real calls

---

## ❓ Questions?

**"How long does voice cloning take?"**
- Recording: 2 minutes
- AWS setup: 20 minutes
- Voice cloning: 30 seconds
- Total: ~25 minutes

**"Will it sound exactly like me?"**
- Yes! XTTS-v2 captures voice characteristics, tone, and emotion
- Quality is excellent with good samples

**"Can I update the voice later?"**
- Yes, just record a new sample and re-clone

**"What if I don't like the result?"**
- Record a different sample
- Adjust speaking style
- Try different emotions

---

## 🎯 Ready to Start?

**Record your voice now:**
1. Open QuickTime or Voice Memos
2. Record 5-10 seconds naturally
3. Save as `alex_voice_sample.wav`
4. Let me know when ready!

I'll then help you deploy AWS and clone your voice for production-quality AI SDR calls.
