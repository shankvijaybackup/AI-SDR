// utils/voice-rotation.js - Voice rotation logic for randomized voice selection

// Helper to get pool configuration lazily
function getRegionalVoicePools() {
  // USER-SELECTED VOICES with REAL NAMES - will introduce as these names
  return {
    US: [
      { name: 'James', id: 'Cz0K1kOv9tD8l0b5Qu53', gender: 'male' },
      { name: 'Michael', id: 'kdVjFjOXaqExaDvXZECX', gender: 'male' },
      { name: 'David', id: 's3TPKV1kjDlVtZbl4Ksh', gender: 'male' },
      { name: 'Daniel', id: 'g6xIsTj2HwM6VR4iXFCw', gender: 'male' },
      { name: 'Matthew', id: 'egTToTzW6GojvddLj0zd', gender: 'male' },
      { name: 'Sarah', id: 'y3UNfL9XC5Bb5htg8B0q', gender: 'female' },
      { name: 'Jennifer', id: 'WtA85syCrJwasGeHGH2p', gender: 'female' },
      { name: 'Emily', id: 'thfYL0Elyru2qqTtNQsE', gender: 'female' },
    ],
    UK: [
      { name: 'Robert', id: 'PoHUWWWMHFrA8z7Q88pu', gender: 'male' },
      { name: 'William', id: 'gJx1vCzNCD1EQHT212Ls', gender: 'male' },
      { name: 'Christopher', id: 'mkrzc6Zmz8alRK0wX5dd', gender: 'male' },
      { name: 'Jessica', id: 'weA4Q36twV5kwSaTEL0Q', gender: 'female' },
      { name: 'Ashley', id: 'JPnpygWDArqL8AVMLMVT', gender: 'female' },
    ],
    AUSTRALIA: [
      { name: 'Thomas', id: 'PIGsltMj3gFMR34aFDI3', gender: 'male' },
      { name: 'Charles', id: 'UgBBYS2sOqTuMpoF3BR0', gender: 'male' },
      { name: 'Andrew', id: 'ZoiZ8fuDWInAcwPXaVeq', gender: 'male' },
      { name: 'Joshua', id: 'NIPHfiR4kB4aHfvaKvYb', gender: 'male' },
      { name: 'Ryan', id: 'w9rPM8AIZle60Nbpw7nl', gender: 'male' },
      { name: 'Amanda', id: 'pPdl9cQBQq4p6mRkZy2Z', gender: 'female' },
      { name: 'Stephanie', id: 'wXEAnFslaqD3RStuH8Qn', gender: 'female' },
      { name: 'Michelle', id: '9vP6R7VVxNwGIGLnpl17', gender: 'female' },
    ],
    ANZ: [
      { name: 'Thomas', id: 'PIGsltMj3gFMR34aFDI3', gender: 'male' },
      { name: 'Ryan', id: 'w9rPM8AIZle60Nbpw7nl', gender: 'male' },
    ],
    // INDIA: Real Indian English accent voices from ElevenLabs shared library
    // Fetched via ElevenLabs API - guaranteed authentic Indian accents
    INDIA: [
      // Indian English female voices - from ElevenLabs shared library
      { name: 'Roohi', id: 'lx9HCNXE1EkLR0EPKlLY', gender: 'female' }, // Natural Customer Care voice
      { name: 'Payal', id: 'zEoa2AiakhTnKPSlAhoX', gender: 'female' }, // Articulate, Clear and Natural
      { name: 'Tina', id: 'KrfvGW2D1x6nS5QnRj2q', gender: 'female' }, // Calm, Confident and Clear
      // Indian English male voices - from ElevenLabs shared library
      { name: 'Aashish', id: 'RpiHVNPKGBg7UmgmrKrN', gender: 'male' }, // Natural Indian male
      { name: 'Sridhar', id: '4djJiaeiIiFtglUCWGdA', gender: 'male' }, // Calm, Natural & Professional
      { name: 'Rahul', id: 'swh0hLPsEaD50F02tIJJ', gender: 'male' }, // Expressive and Clear
    ],
  };
}

// Fallback pool helper - USER SELECTED VOICES with REAL NAMES
function getDefaultVoicePool() {
  return [
    // Male voices
    { name: 'James', id: 'Cz0K1kOv9tD8l0b5Qu53', gender: 'male' },
    { name: 'Michael', id: 'kdVjFjOXaqExaDvXZECX', gender: 'male' },
    { name: 'David', id: 's3TPKV1kjDlVtZbl4Ksh', gender: 'male' },
    { name: 'Robert', id: 'PoHUWWWMHFrA8z7Q88pu', gender: 'male' },
    { name: 'William', id: 'gJx1vCzNCD1EQHT212Ls', gender: 'male' },
    { name: 'Thomas', id: 'PIGsltMj3gFMR34aFDI3', gender: 'male' },
    { name: 'Charles', id: 'UgBBYS2sOqTuMpoF3BR0', gender: 'male' },
    { name: 'Daniel', id: 'g6xIsTj2HwM6VR4iXFCw', gender: 'male' },
    { name: 'Matthew', id: 'egTToTzW6GojvddLj0zd', gender: 'male' },
    { name: 'Christopher', id: 'mkrzc6Zmz8alRK0wX5dd', gender: 'male' },
    { name: 'Andrew', id: 'ZoiZ8fuDWInAcwPXaVeq', gender: 'male' },
    { name: 'Joshua', id: 'NIPHfiR4kB4aHfvaKvYb', gender: 'male' },
    { name: 'Ryan', id: 'w9rPM8AIZle60Nbpw7nl', gender: 'male' },
    // Female voices
    { name: 'Sarah', id: 'y3UNfL9XC5Bb5htg8B0q', gender: 'female' },
    { name: 'Jennifer', id: 'WtA85syCrJwasGeHGH2p', gender: 'female' },
    { name: 'Emily', id: 'thfYL0Elyru2qqTtNQsE', gender: 'female' },
    { name: 'Jessica', id: 'weA4Q36twV5kwSaTEL0Q', gender: 'female' },
    { name: 'Ashley', id: 'JPnpygWDArqL8AVMLMVT', gender: 'female' },
    { name: 'Amanda', id: 'pPdl9cQBQq4p6mRkZy2Z', gender: 'female' },
    { name: 'Stephanie', id: 'wXEAnFslaqD3RStuH8Qn', gender: 'female' },
    { name: 'Michelle', id: '9vP6R7VVxNwGIGLnpl17', gender: 'female' },
  ];
}

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
  const pool = filterValidVoices(getDefaultVoicePool());
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
  const voicesOfGender = filterValidVoices(getDefaultVoicePool()).filter(v => v.gender === gender);

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
  return filterValidVoices(getDefaultVoicePool());
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
  const voicePool = normalizedRegion ? getRegionalVoicePools()[normalizedRegion] : null;

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
