import wave
import struct
import os

# Ensure directory exists
os.makedirs('voice-service/speakers', exist_ok=True)

# Create a dummy silent wav file for testing
sample_rate = 24000
duration = 1.0 # seconds
num_samples = int(sample_rate * duration)

with wave.open('voice-service/speakers/alex.wav', 'w') as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    data = struct.pack('<' + ('h'*num_samples), *([0]*num_samples))
    wav_file.writeframes(data)

print("Created dummy speakers/alex.wav")
