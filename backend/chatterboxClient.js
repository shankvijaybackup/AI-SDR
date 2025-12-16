import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const CHATTERBOX_URL = process.env.CHATTERBOX_TTS_URL || "http://localhost:8001";

export async function synthesizeWithChatterbox(text, voiceId = "default", options = {}) {
  const {
    exaggeration = 0.5,
    cfg_weight = 0.5,
    output_format = "mp3"
  } = options;

  try {
    const response = await fetch(`${CHATTERBOX_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        exaggeration,
        cfg_weight,
        output_format
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chatterbox TTS failed: ${response.status} - ${errorText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("[Chatterbox] Synthesis error:", error);
    throw error;
  }
}

export async function cloneVoice(voiceId, audioFilePath, description = null) {
  try {
    const formData = new FormData();
    formData.append("voice_id", voiceId);
    formData.append("audio_file", fs.createReadStream(audioFilePath));
    if (description) {
      formData.append("description", description);
    }

    const response = await fetch(`${CHATTERBOX_URL}/clone-voice`, {
      method: "POST",
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice cloning failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Chatterbox] Voice cloning error:", error);
    throw error;
  }
}

export async function listVoices() {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/voices`);
    
    if (!response.ok) {
      throw new Error(`Failed to list voices: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Chatterbox] List voices error:", error);
    throw error;
  }
}

export async function deleteVoice(voiceId) {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/voices/${voiceId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Failed to delete voice: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[Chatterbox] Delete voice error:", error);
    throw error;
  }
}

export async function healthCheck() {
  try {
    const response = await fetch(`${CHATTERBOX_URL}/health`);
    
    if (!response.ok) {
      return { status: "unhealthy", error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (error) {
    return { status: "unreachable", error: error.message };
  }
}
