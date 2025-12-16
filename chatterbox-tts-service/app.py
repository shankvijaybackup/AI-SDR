"""
Chatterbox TTS Microservice
Provides fast, high-quality text-to-speech with voice cloning
Compatible with Twilio Media Streams (μ-law audio format)
"""

import os
import io
import base64
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import torchaudio as ta
import torch
import numpy as np
from scipy.io import wavfile

# Import Chatterbox
from chatterbox.tts import ChatterboxTTS

# Initialize FastAPI
app = FastAPI(title="Chatterbox TTS Service", version="1.0.0")

# Global model instance
model = None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Voice cache for different personas
VOICE_CACHE = {}

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "default"
    audio_prompt_path: Optional[str] = None
    exaggeration: Optional[float] = 0.5
    cfg_weight: Optional[float] = 0.5
    output_format: Optional[str] = "mp3"  # mp3, wav, ulaw (for Twilio)

class VoiceCloneRequest(BaseModel):
    voice_id: str
    description: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    """Load Chatterbox model on startup"""
    global model
    print(f"🚀 Loading Chatterbox TTS model on {DEVICE}...")
    model = ChatterboxTTS.from_pretrained(device=DEVICE)
    print("✅ Chatterbox TTS ready!")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    Synthesize speech from text
    Returns audio in requested format (mp3, wav, or ulaw for Twilio)
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        print(f"[TTS] Synthesizing: {request.text[:50]}...")
        
        # Get audio prompt path if voice_id is specified
        audio_prompt_path = None
        if request.audio_prompt_path:
            audio_prompt_path = request.audio_prompt_path
        elif request.voice_id != "default" and request.voice_id in VOICE_CACHE:
            audio_prompt_path = VOICE_CACHE[request.voice_id]
        
        # Generate speech
        wav = model.generate(
            request.text,
            audio_prompt_path=audio_prompt_path,
            exaggeration=request.exaggeration,
            cfg_weight=request.cfg_weight
        )
        
        # Convert to requested format
        if request.output_format == "ulaw":
            # Convert to μ-law for Twilio (8kHz, mono)
            audio_data = convert_to_ulaw(wav, model.sr)
            return Response(
                content=audio_data,
                media_type="audio/basic",
                headers={"Content-Disposition": "inline; filename=speech.ulaw"}
            )
        
        elif request.output_format == "wav":
            # Convert to WAV
            buffer = io.BytesIO()
            ta.save(buffer, wav, model.sr, format="wav")
            buffer.seek(0)
            return Response(
                content=buffer.read(),
                media_type="audio/wav",
                headers={"Content-Disposition": "inline; filename=speech.wav"}
            )
        
        else:  # mp3 (default)
            # Convert to MP3
            buffer = io.BytesIO()
            ta.save(buffer, wav, model.sr, format="mp3")
            buffer.seek(0)
            return Response(
                content=buffer.read(),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline; filename=speech.mp3"}
            )
    
    except Exception as e:
        print(f"[TTS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/synthesize/stream")
async def synthesize_speech_stream(request: TTSRequest):
    """
    Stream synthesized speech (for future real-time streaming support)
    Currently returns full audio but can be extended for chunk streaming
    """
    # For now, return the full audio
    # Future: implement chunk-by-chunk streaming
    return await synthesize_speech(request)

@app.post("/clone-voice")
async def clone_voice(
    voice_id: str,
    audio_file: UploadFile = File(...),
    description: Optional[str] = None
):
    """
    Upload a voice sample for cloning
    Stores the audio file and associates it with voice_id
    """
    try:
        # Create voices directory if it doesn't exist
        voices_dir = "/app/voices"
        os.makedirs(voices_dir, exist_ok=True)
        
        # Save the uploaded file
        file_path = os.path.join(voices_dir, f"{voice_id}.wav")
        
        content = await audio_file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Cache the voice
        VOICE_CACHE[voice_id] = file_path
        
        print(f"✅ Voice cloned: {voice_id} -> {file_path}")
        
        return {
            "status": "success",
            "voice_id": voice_id,
            "description": description,
            "file_path": file_path
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")

@app.get("/voices")
async def list_voices():
    """List all available cloned voices"""
    return {
        "voices": list(VOICE_CACHE.keys()),
        "default_voice": "default"
    }

@app.delete("/voices/{voice_id}")
async def delete_voice(voice_id: str):
    """Delete a cloned voice"""
    if voice_id not in VOICE_CACHE:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    file_path = VOICE_CACHE[voice_id]
    if os.path.exists(file_path):
        os.remove(file_path)
    
    del VOICE_CACHE[voice_id]
    
    return {"status": "success", "message": f"Voice {voice_id} deleted"}

def convert_to_ulaw(wav_tensor, sample_rate):
    """
    Convert audio tensor to μ-law format for Twilio
    Twilio expects: 8kHz, mono, μ-law encoded
    """
    # Resample to 8kHz if needed
    if sample_rate != 8000:
        resampler = ta.transforms.Resample(sample_rate, 8000)
        wav_tensor = resampler(wav_tensor)
    
    # Convert to mono if stereo
    if wav_tensor.shape[0] > 1:
        wav_tensor = torch.mean(wav_tensor, dim=0, keepdim=True)
    
    # Convert to numpy and normalize to int16 range
    audio_np = wav_tensor.squeeze().numpy()
    audio_np = np.clip(audio_np, -1.0, 1.0)
    audio_int16 = (audio_np * 32767).astype(np.int16)
    
    # Encode to μ-law
    # Python doesn't have native μ-law, so we'll use a simple conversion
    # For production, consider using audioop or a dedicated library
    import audioop
    ulaw_data = audioop.lin2ulaw(audio_int16.tobytes(), 2)
    
    return ulaw_data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
