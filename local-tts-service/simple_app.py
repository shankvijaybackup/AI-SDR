"""
Simple Local TTS Service for Mac Studio Testing
Uses gTTS (Google Text-to-Speech) - works offline after first download
"""

import os
import io
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from gtts import gTTS
from pydub import AudioSegment
import tempfile

app = FastAPI(title="Local TTS Testing Service", version="1.0.0")

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "default"
    output_format: Optional[str] = "mp3"

@app.on_event("startup")
async def startup_event():
    """Startup message"""
    print("🚀 Local TTS Testing Service starting...")
    print("✅ Ready to synthesize speech!")
    print("📝 Note: This uses gTTS for testing. Deploy to AWS for production quality.")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": True,
        "device": "cpu",
        "engine": "gTTS",
        "note": "Local testing service - works on Mac Studio"
    }

@app.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    Synthesize speech from text using gTTS
    Returns audio in requested format
    """
    try:
        print(f"[TTS] Synthesizing: {request.text[:50]}...")
        
        # Use gTTS to generate speech
        tts = gTTS(text=request.text, lang='en', slow=False)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp_file:
            tmp_path = tmp_file.name
        
        tts.save(tmp_path)
        
        # Read the MP3 file
        audio = AudioSegment.from_mp3(tmp_path)
        
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
        
        print(f"[TTS] ✅ Synthesis complete ({len(buffer.getvalue())} bytes)")
        
        return Response(
            content=buffer.read(),
            media_type=media_type,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    
    except Exception as e:
        print(f"[TTS] ❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/clone-voice")
async def clone_voice(voice_id: str):
    """
    Mock voice cloning endpoint for testing
    """
    return {
        "status": "success",
        "voice_id": voice_id,
        "note": "Voice cloning not available in local testing. Deploy to AWS for voice cloning with XTTS-v2 or Chatterbox."
    }

@app.get("/voices")
async def list_voices():
    """List available voices"""
    return {
        "voices": ["default"],
        "note": "gTTS uses Google's default voice. Deploy to AWS for custom voice cloning."
    }

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("🎤 Local TTS Testing Service")
    print("="*60)
    print("Starting on http://localhost:8001")
    print("Press Ctrl+C to stop")
    print("="*60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
