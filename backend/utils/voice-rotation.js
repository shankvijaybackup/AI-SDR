// utils/voice-rotation.js - Voice rotation logic for randomized voice selection

const REGIONAL_VOICE_POOLS = {
  US: [
    { name: 'Arabella', id: process.env.ELEVEN_VOICE_ARABELLA, gender: 'female' },
    { name: 'Brandon', id: process.env.ELEVEN_VOICE_BRANDON, gender: 'male' },
    { name: 'Adam', id: process.env.ELEVEN_VOICE_ADAM, gender: 'male' },
    { name: 'Jane', id: process.env.ELEVEN_VOICE_JANE, gender: 'female' },
  ],
  UK: [
    { name: 'Arabella', id: process.env.ELEVEN_VOICE_ARABELLA, gender: 'female' },
    { name: 'Brandon', id: process.env.ELEVEN_VOICE_BRANDON, gender: 'male' },
    { name: 'Adam', id: process.env.ELEVEN_VOICE_ADAM, gender: 'male' },
  ],
  Australia: [
    { name: 'Anika', id: process.env.ELEVEN_VOICE_ANIKA, gender: 'female' },
    { name: 'Brandon', id: process.env.ELEVEN_VOICE_BRANDON, gender: 'male' },
    { name: 'Jane', id: process.env.ELEVEN_VOICE_JANE, gender: 'female' },
  ],
  India: [
    { name: 'Anika', id: process.env.ELEVEN_VOICE_ANIKA, gender: 'female' },
    { name: 'Arabella', id: process.env.ELEVEN_VOICE_ARABELLA, gender: 'female' },
    { name: 'Adam', id: process.env.ELEVEN_VOICE_ADAM, gender: 'male' },
  ],
};

// Fallback voice pool for when no region is specified
const DEFAULT_VOICE_POOL = [
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
  const randomIndex = Math.floor(Math.random() * DEFAULT_VOICE_POOL.length);
  const voice = DEFAULT_VOICE_POOL[randomIndex];
  
  console.log(`[Voice Rotation] Selected: ${voice.name} (${voice.gender})`);
  
  return voice;
}

/**
 * Get voice by gender (for backward compatibility)
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} { name: string, id: string, gender: string }
 */
export function getVoiceByGender(gender) {
  const voicesOfGender = DEFAULT_VOICE_POOL.filter(v => v.gender === gender);
  
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
  return DEFAULT_VOICE_POOL;
}

/**
 * Get voice by region/location
 * @param {string} region - 'India', 'UK', 'Australia', 'US'
 * @returns {Object} Voice object
 */
export function getVoiceByLocation(region) {
  // If no region provided, fall back to random voice
  if (!region) {
    console.log(`[Voice Rotation] No region specified, using random voice`);
    return getRandomVoice();
  }
  
  // Normalize region name to uppercase for consistency with pool keys
  const normalizedRegion = region.toUpperCase();
  
  const voicePool = REGIONAL_VOICE_POOLS[normalizedRegion];
  
  if (!voicePool) {
    console.warn(`[Voice Rotation] No voice pool found for region: ${region} (normalized: ${normalizedRegion}), using default`);
    return getRandomVoice();
  }
  
  const randomIndex = Math.floor(Math.random() * voicePool.length);
  const voice = voicePool[randomIndex];
  
  console.log(`[Voice Rotation] Selected ${normalizedRegion} voice: ${voice.name} (${voice.gender})`);
  
  return voice;
}
