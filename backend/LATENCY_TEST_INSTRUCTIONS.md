# 🧪 Live Call Latency Testing Instructions

**Date**: December 15, 2025  
**System**: AI SDR Outbound Calling with GPT-3.5-turbo (Optimized for Speed)

---

## ✅ Changes Made

### 1. Switched to GPT-3.5-turbo
- **Previous**: `gpt-4o-mini` (1500ms average)
- **Current**: `gpt-3.5-turbo` (500-800ms average)
- **Expected Improvement**: 500-1000ms faster
- **Tradeoff**: Slightly lower quality responses

### 2. Email Confirmation Fixed
- Lead email now passed to AI during calls
- AI will confirm email instead of asking repeatedly
- Checks against lead email from database

---

## 📝 How to Test

### Step 1: Make a Test Call

1. Open the frontend: http://localhost:3000/calling
2. Select your lead (VIJAY JAYASHANKAR)
3. Select script and voice persona
4. Click "Start Call"
5. Answer the phone

### Step 2: Measure Latency

**Use a stopwatch or phone timer:**

1. **Say "hello"** → Start timer
2. **AI starts speaking** → Stop timer
3. Record the time

**Repeat for different responses:**
- Simple greeting: "hello"
- Discovery question: "we use ServiceNow"
- Consultative response: "it's not easy to use"
- Email confirmation: "my email is shankvijay@gmail.com"

### Step 3: Check Backend Logs

**Look for these log patterns:**

```
➡️  /api/twilio/handle-speech hit. Speech: hello
[AI] Phase: rapport
[AI] Reply: I'm doing great, thanks!...
[AI] Processing time: 650ms  ← OpenAI latency (should be 500-800ms now)
[ElevenLabs] Synthesizing (Female) for CA...
[ElevenLabs] Audio ready at: https://...
[AI Reply] Playing: https://...
```

**Key metrics to record:**
- `[AI] Processing time: XXXms` = OpenAI latency
- Time between "Synthesizing" and "Audio ready" = TTS latency
- Your stopwatch time = Total end-to-end latency

---

## 📊 Expected Results

### With GPT-3.5-turbo (Current)

| Component | Previous (GPT-4o-mini) | Current (GPT-3.5-turbo) | Improvement |
|-----------|------------------------|-------------------------|-------------|
| OpenAI | 1500ms | 500-800ms | 700-1000ms |
| ElevenLabs TTS | 400ms | 400ms | 0ms |
| Twilio STT | 300ms | 300ms | 0ms |
| Playback | 150ms | 150ms | 0ms |
| **Total** | **2350ms** | **1350-1650ms** | **700-1000ms** |

**Target**: 1.3-1.7 seconds end-to-end (down from 2.3-2.5s)

---

## 🎯 What to Look For

### ✅ Good Signs
- AI responds in **1.3-1.7 seconds** (feels more natural)
- Responses are still coherent and on-brand
- Email confirmation works (doesn't ask multiple times)
- No crashes or errors

### ⚠️ Quality Concerns
- Responses feel less sophisticated
- AI misses context or nuance
- Objection handling is weaker
- Pitch is less compelling

### ❌ Bad Signs
- Latency is still 2+ seconds (no improvement)
- AI gives nonsensical responses
- Crashes or errors
- Email confirmation still broken

---

## 📋 Test Checklist

### Latency Tests
- [ ] Simple greeting response time: _____ seconds
- [ ] Discovery question response time: _____ seconds
- [ ] Consultative response time: _____ seconds
- [ ] Pitch response time: _____ seconds
- [ ] Email confirmation response time: _____ seconds

### Quality Tests
- [ ] Responses are coherent and natural
- [ ] AI stays in correct conversation phase
- [ ] Objection handling is effective
- [ ] Email confirmation works correctly
- [ ] No crashes or errors

### Backend Log Metrics
- [ ] OpenAI processing time: _____ ms (target: 500-800ms)
- [ ] ElevenLabs TTS time: _____ ms (target: 300-500ms)
- [ ] Total end-to-end: _____ ms (target: 1300-1700ms)

---

## 🔧 If Latency Is Still High

### Check 1: OpenAI Processing Time
```
[AI] Processing time: XXXXms
```
- **If 500-800ms**: ✅ GPT-3.5-turbo is working
- **If 1500ms+**: ❌ Still using GPT-4o-mini (server didn't reload)

### Check 2: Network Issues
```
[ElevenLabs] Audio ready at: ...
```
- Time between "Synthesizing" and "Audio ready" should be 300-500ms
- If 1000ms+: Network latency issue (Australia → US)

### Check 3: Server Restart
If OpenAI time is still high:
```bash
cd backend
pkill -9 -f "node server.js"
npm run dev
```

---

## 📊 Latency Comparison Table

| Scenario | GPT-4o-mini | GPT-3.5-turbo | Human Baseline |
|----------|-------------|---------------|----------------|
| Simple greeting | 1.8s | 1.2s | 0.3s |
| Discovery question | 2.2s | 1.5s | 0.5s |
| Consultative | 2.8s | 1.8s | 0.8s |
| Pitch | 3.2s | 2.0s | 1.0s |

**Note**: Even with GPT-3.5-turbo, we're still 2-3x slower than human conversation. This is an architectural limitation.

---

## 🎯 Decision Matrix

### If Latency Improved (1.3-1.7s) AND Quality Good
✅ **Keep GPT-3.5-turbo** - Best balance of speed and quality

### If Latency Improved BUT Quality Poor
⚠️ **Revert to GPT-4o-mini** - Quality matters more than 700ms

### If Latency NOT Improved
❌ **Debug** - Server didn't reload or other issue

---

## 📝 Test Results Template

```
Date: _______________
Tester: _______________

Latency Results:
- Simple greeting: _____ seconds
- Discovery: _____ seconds
- Consultative: _____ seconds
- Pitch: _____ seconds
- Email confirmation: _____ seconds

Backend Metrics:
- OpenAI avg: _____ ms
- ElevenLabs avg: _____ ms
- Total avg: _____ ms

Quality Assessment:
- Coherence: ⭐⭐⭐⭐⭐
- Natural flow: ⭐⭐⭐⭐⭐
- Objection handling: ⭐⭐⭐⭐⭐
- Email confirmation: ⭐⭐⭐⭐⭐

Decision:
[ ] Keep GPT-3.5-turbo
[ ] Revert to GPT-4o-mini
[ ] Need more testing

Notes:
_________________________________
_________________________________
_________________________________
```

---

## 🚀 Next Steps After Testing

### If GPT-3.5-turbo Works Well
1. Document the latency improvement
2. Update system documentation
3. Monitor quality over multiple calls
4. Consider this the production configuration

### If Quality Is Poor
1. Revert to GPT-4o-mini
2. Accept 2.3s latency as architectural limitation
3. Consider streaming architecture (2-3 weeks work)

### If You Want Even Lower Latency
1. Implement streaming OpenAI responses (2-3 weeks)
2. Fix Media Stream architecture (1 week)
3. Pre-cache common responses (1 week)

---

**Ready to test? Make a call and record the results!**
