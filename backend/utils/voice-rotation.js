// utils/voice-rotation.js - Voice rotation logic for randomized voice selection

const VOICE_POOL = [
  { name: 'Arabella', id: process.env.ELEVEN_VOICE_ARABELLA, gender: 'female' },
  { name: 'Anika', id: process.env.ELEVEN_VOICE_ANIKA, gender: 'female' },
  { name: 'Brandon', id: process.env.ELEVEN_VOICE_BRANDON, gender: 'male' },
  { name: 'Adam', id: process.env.ELEVEN_VOICE_ADAM, gender: 'male' },
  { name: 'Jane', id: process.env.ELEVEN_VOICE_JANE, gender: 'female' },
];

/**
 * Get a random voice from the pool
 * @returns {Object} { name: string, id: string, gender: string }
 */
export function getRandomVoice() {
  const randomIndex = Math.floor(Math.random() * VOICE_POOL.length);
  const voice = VOICE_POOL[randomIndex];
  
  console.log(`[Voice Rotation] Selected: ${voice.name} (${voice.gender})`);
  
  return voice;
}

/**
 * Get voice by gender (for backward compatibility)
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} { name: string, id: string, gender: string }
 */
export function getVoiceByGender(gender) {
  const voicesOfGender = VOICE_POOL.filter(v => v.gender === gender);
  
  if (voicesOfGender.length === 0) {
    console.warn(`[Voice Rotation] No voices found for gender: ${gender}, using random`);
    return getRandomVoice();
  }
  
  const randomIndex = Math.floor(Math.random() * voicesOfGender.length);
  const voice = voicesOfGender[randomIndex];
  
  console.log(`[Voice Rotation] Selected ${gender} voice: ${voice.name}`);
  
  return voice;
}

/**
 * Get voice pool for display/debugging
 * @returns {Array} Voice pool
 */
export function getVoicePool() {
  return VOICE_POOL;
}

/**
 * Future: Get voice by location/accent
 * @param {string} location - Country code or region
 * @returns {Object} Voice object
 */
export function getVoiceByLocation(location) {
  // TODO: Implement location-based voice selection
  // For now, return random voice
  console.log(`[Voice Rotation] Location-based selection not yet implemented for: ${location}`);
  return getRandomVoice();
}
