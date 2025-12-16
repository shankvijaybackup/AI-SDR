"""
Local TTS Service for Testing
Uses pyttsx3 (offline TTS) for quick local testing
For production, deploy to AWS with XTTS-v2 or Chatterbox
"""

import os
import io
import base64
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import pyttsx3
from pydub import AudioSegment
import tempfile

app = FastAPI(title="Local TTS Service", version="1.0.0")

# Initialize TTS engine
engine = None

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "default"
    output_format: Optional[str] = "mp3"

@app.on_event("startup")
async def startup_event():
    """Initialize TTS engine on startup"""
    global engine
    print("🚀 Loading Local TTS engine...")
    engine = pyttsx3.init()
    
    # Set voice properties
    voices = engine.getProperty('voices')
    if len(voices) > 0:
        engine.setProperty('voice', voices[0].id)  # Default voice
    engine.setProperty('rate', 175)  # Speed
    engine.setProperty('volume', 0.9)  # Volume
    
    print("✅ Local TTS ready!")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": engine is not None,
        "device": "cpu",
        "note": "Local testing TTS - deploy to AWS for production quality"
    }

@app.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    Synthesize speech from text
    Returns audio in requested format
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="TTS engine not loaded")
    
    try:
        print(f"[TTS] Synthesizing: {request.text[:50]}...")
        
        # Create temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            tmp_path = tmp_file.name
        
        # Synthesize to WAV
        engine.save_to_file(request.text, tmp_path)
        engine.runAndWait()
        
        # Read WAV file
        audio = AudioSegment.from_wav(tmp_path)
        
        # Convert to requested format
        buffer = io.BytesIO()
        if request.output_format == "mp3":
            audio.export(buffer, format="mp3", bitrate="128k")
            media_type = "audio/mpeg"
            filename = "speech.mp3"
        elif request.output_format == "wav":
            audio.export(buffer, format="wav")
            media_type = "audio/wav"
            filename = "speech.wav"
        else:  # ulaw for Twilio
            audio = audio.set_frame_rate(8000).set_channels(1)
            audio.export(buffer, format="wav", codec="pcm_mulaw")
            media_type = "audio/basic"
            filename = "speech.ulaw"
        
        buffer.seek(0)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        return Response(
            content=buffer.read(),
            media_type=media_type,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    
    except Exception as e:
        print(f"[TTS] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/clone-voice")
async def clone_voice(voice_id: str):
    """
    Mock voice cloning endpoint
    Local TTS doesn't support voice cloning - use AWS for this
    """
    return {
        "status": "success",
        "voice_id": voice_id,
        "note": "Voice cloning not available in local testing mode. Deploy to AWS for voice cloning."
    }

@app.get("/voices")
async def list_voices():
    """List available voices"""
    voices = engine.getProperty('voices') if engine else []
    return {
        "voices": [{"id": v.id, "name": v.name} for v in voices],
        "note": "Local system voices - limited quality. Deploy to AWS for custom voice cloning."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
