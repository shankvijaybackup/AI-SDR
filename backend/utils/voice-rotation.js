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
  AUSTRALIA: [
    { name: 'Anika', id: process.env.ELEVEN_VOICE_ANIKA, gender: 'female' },
    { name: 'Brandon', id: process.env.ELEVEN_VOICE_BRANDON, gender: 'male' },
    { name: 'Jane', id: process.env.ELEVEN_VOICE_JANE, gender: 'female' },
  ],
  ANZ: [
    { name: 'Anika', id: process.env.ELEVEN_VOICE_ANIKA, gender: 'female' },
    { name: 'Brandon', id: process.env.ELEVEN_VOICE_BRANDON, gender: 'male' },
    { name: 'Jane', id: process.env.ELEVEN_VOICE_JANE, gender: 'female' },
  ],
  // INDIA: Use dedicated Indian English accent voices from ElevenLabs
  // These are voices with authentic Indian accents for India region calls
  INDIA: [
    // Indian English female voices
    { name: 'Priya', id: process.env.ELEVEN_VOICE_INDIA_FEMALE || 'pFZP5JQG7iQjIQuC4Bku', gender: 'female' }, // Lily - has Indian accent
    { name: 'Ananya', id: process.env.ELEVEN_VOICE_INDIA_FEMALE_2 || 'jsCqWAovK2LkecY7zXl4', gender: 'female' }, // Freya - warm, clear
    // Indian English male voices  
    { name: 'Raj', id: process.env.ELEVEN_VOICE_INDIA_MALE || 'TX3LPaxmHKxFdv7VOQHJ', gender: 'male' }, // Liam - clear pronunciation
    { name: 'Vikram', id: process.env.ELEVEN_VOICE_INDIA_MALE_2 || 'iP95p4xoKVk53GoZ742B', gender: 'male' }, // Chris - professional
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

const regionRotationIndex = new Map();

function normalizeRegionKey(region) {
  if (!region) return null;
  const raw = String(region).trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES' || upper === 'UNITED STATES OF AMERICA') return 'US';
  if (upper === 'UK' || upper === 'UNITED KINGDOM' || upper === 'GB' || upper === 'GREAT BRITAIN' || upper === 'ENGLAND') return 'UK';
  if (upper === 'IN' || upper === 'INDIA') return 'INDIA';
  if (upper === 'AU' || upper === 'AUSTRALIA') return 'AUSTRALIA';
  if (upper === 'NZ' || upper === 'NEW ZEALAND') return 'ANZ';
  if (upper === 'ANZ') return 'ANZ';
  return upper;
}

function filterValidVoices(voices) {
  return (voices || []).filter((v) => v && typeof v.id === 'string' && v.id.trim().length > 0);
}

function getNextVoiceFromPool(regionKey, pool) {
  const safePool = filterValidVoices(pool);
  if (safePool.length === 0) return null;

  const currentIdx = regionRotationIndex.get(regionKey) || 0;
  const idx = currentIdx % safePool.length;
  const voice = safePool[idx];
  regionRotationIndex.set(regionKey, (currentIdx + 1) % safePool.length);
  return voice;
}

/**
 * Get a random voice from the pool
 * @returns {Object} { name: string, id: string, gender: string }
 */
export function getRandomVoice() {
  const pool = filterValidVoices(DEFAULT_VOICE_POOL);
  if (pool.length === 0) {
    console.warn('[Voice Rotation] No valid voices configured in DEFAULT_VOICE_POOL');
    return { name: 'Default', id: '', gender: 'unknown' };
  }

  const voice = getNextVoiceFromPool('DEFAULT', pool);
  console.log(`[Voice Rotation] Selected: ${voice.name} (${voice.gender})`);
  return voice;
}

/**
 * Get voice by gender (for backward compatibility)
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} { name: string, id: string, gender: string }
 */
export function getVoiceByGender(gender) {
  const voicesOfGender = filterValidVoices(DEFAULT_VOICE_POOL).filter(v => v.gender === gender);

  if (voicesOfGender.length === 0) {
    console.warn(`[Voice Rotation] No voices found for gender: ${gender}, using random`);
    return getRandomVoice();
  }

  const voice = getNextVoiceFromPool(`GENDER:${String(gender || '').toLowerCase()}`, voicesOfGender);
  console.log(`[Voice Rotation] Selected ${gender} voice: ${voice.name}`);
  return voice;
}

/**
 * Get voice pool for display/debugging
 * @returns {Array} Voice pool
 */
export function getVoicePool() {
  return filterValidVoices(DEFAULT_VOICE_POOL);
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

  const normalizedRegion = normalizeRegionKey(region);
  const voicePool = normalizedRegion ? REGIONAL_VOICE_POOLS[normalizedRegion] : null;

  if (!voicePool) {
    console.warn(`[Voice Rotation] No voice pool found for region: ${region} (normalized: ${normalizedRegion}), using default`);
    return getRandomVoice();
  }

  const rotated = getNextVoiceFromPool(normalizedRegion, voicePool);
  if (!rotated) {
    console.warn(`[Voice Rotation] No valid voice IDs configured for region: ${region} (normalized: ${normalizedRegion}), using default`);
    return getRandomVoice();
  }

  console.log(`[Voice Rotation] Selected ${normalizedRegion} voice: ${rotated.name} (${rotated.gender})`);
  return rotated;
}
