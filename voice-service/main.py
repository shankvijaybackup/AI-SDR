import os
from typing import Dict, Generator

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from TTS.api import TTS  # from coqui-tts / TTS package

# ---------- Config ----------

# Model name from Coqui TTS docs / HF model card
# XTTS-v2: multilingual, voice cloning, 24 kHz sample rate.
# https://coqui.ai and https://huggingface.co/coqui/XTTS-v2
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

# Map logical speaker IDs to reference wav paths
SPEAKERS: Dict[str, str] = {
    "alex": os.path.join("speakers", "alex.wav"),
    # Add more, e.g. "emma": "speakers/emma.wav"
}

DEFAULT_SPEAKER = "alex"
DEFAULT_LANG = "en"

# Chunk size of PCM bytes we stream back.
# Each sample = 2 bytes (int16). 24kHz * 0.1s * 2 bytes ≈ 4800 bytes → ~100 ms chunks.
PCM_CHUNK_BYTES = 4800


# ---------- Model Load (on startup) ----------

print("Loading XTTS-v2 model… this may take a bit on first run.")
# .to("cuda") if you run with a GPU, .to("cpu") is fine but slower.
# We check for generic env var or default to cpu for safety in this demo
device = "cuda" if os.environ.get("USE_CUDA") == "1" else "cpu"
print(f"Using device: {device}")

try:
    tts = TTS(MODEL_NAME).to(device)
    print("XTTS-v2 loaded.")
except Exception as e:
    print(f"Warning: Failed to load XTTS model. Make sure coqui-tts is installed. Error: {e}")
    tts = None


# ---------- FastAPI app ----------

app = FastAPI(title="XTTS-v2 Voice Service", version="0.1.0")


class TTSRequest(BaseModel):
    text: str
    speaker: str | None = None   # logical speaker id
    language: str | None = None  # e.g. "en"


def _synthesize_to_pcm(text: str, speaker_id: str, language: str) -> bytes:
    """Run XTTS-v2 and return 16-bit PCM bytes at 24 kHz."""
    if tts is None:
         raise HTTPException(status_code=500, detail="TTS model not loaded")

    if speaker_id not in SPEAKERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown speaker '{speaker_id}'. Known: {list(SPEAKERS.keys())}",
        )

    speaker_wav = SPEAKERS[speaker_id]
    if not os.path.exists(speaker_wav):
        raise HTTPException(
            status_code=500,
            detail=f"Speaker reference wav not found: {speaker_wav}",
        )

    # XTTS-v2 inference – returns float32 numpy array, typically in [-1, 1]
    # API per Coqui TTS docs: tts.tts(text=..., speaker_wav=..., language=...) 
    audio = tts.tts(text=text, speaker_wav=speaker_wav, language=language)

    # Convert float [-1, 1] to 16-bit PCM
    audio = np.asarray(audio, dtype=np.float32)
    audio = np.clip(audio, -1.0, 1.0)
    pcm16 = (audio * 32767.0).astype(np.int16)

    return pcm16.tobytes()


def _iter_pcm_chunks(pcm_bytes: bytes, chunk_size: int = PCM_CHUNK_BYTES) -> Generator[bytes, None, None]:
    """Yield PCM data in fixed-size chunks for streaming."""
    total = len(pcm_bytes)
    pos = 0
    while pos < total:
        chunk = pcm_bytes[pos : pos + chunk_size]
        if not chunk:
            break
        yield chunk
        pos += chunk_size


@app.post("/tts")
async def tts_stream(req: TTSRequest):
    """
    POST /tts
    JSON body: { "text": "...", "speaker": "alex", "language": "en" }

    Response: streaming 16-bit PCM at 24kHz (no WAV header),
    Content-Type: application/octet-stream
    """
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    speaker_id = (req.speaker or DEFAULT_SPEAKER).strip()
    language = (req.language or DEFAULT_LANG).strip()

    try:
        pcm_bytes = _synthesize_to_pcm(text, speaker_id, language)
    except HTTPException:
        # bubble up HTTP errors from _synthesize_to_pcm
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {e}")

    # Stream as raw PCM – your Node bridge will:
    # 1) read these chunks,
    # 2) treat as 24kHz int16 PCM,
    # 3) downsample + mu-law encode for Twilio.
    return StreamingResponse(
        _iter_pcm_chunks(pcm_bytes),
        media_type="application/octet-stream",
    )


@app.get("/health")
async def health_check():
    return {"ok": True, "model": MODEL_NAME, "loaded": tts is not None}
