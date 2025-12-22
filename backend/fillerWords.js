// Filler Words - Play natural conversational sounds while AI is thinking
// This dramatically improves perceived latency by filling silence

// Pre-defined filler sounds for different contexts
const FILLER_SOUNDS = {
    // General thinking fillers (play immediately when AI starts processing)
    thinking: [
        "Hmm...",
        "Okay...",
        "Right...",
        "Mm-hmm...",
        "Let me think...",
        "So...",
        "Well...",
        "Alright...",
    ],

    // Acknowledgment fillers (when they just finished speaking)
    acknowledgment: [
        "I hear you.",
        "Got it.",
        "Mm-hmm...",
        "Right, right.",
        "I see.",
        "Makes sense.",
    ],

    // Transition fillers (when moving between topics)
    transition: [
        "So here's the thing...",
        "You know what...",
        "Actually...",
        "Here's what I'm thinking...",
    ],

    // Empathy fillers (when responding to concerns/objections)
    empathy: [
        "Totally understand.",
        "I hear you on that.",
        "That makes sense.",
        "Yeah, that's fair.",
    ],
};

/**
 * Get a random filler phrase based on context
 * @param {string} context - 'thinking', 'acknowledgment', 'transition', 'empathy'
 * @returns {string} - Filler phrase
 */
export function getFillerPhrase(context = 'thinking') {
    const phrases = FILLER_SOUNDS[context] || FILLER_SOUNDS.thinking;
    return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Determine what type of filler to use based on user input
 * @param {string} userText - What the user just said
 * @param {string} phase - Current conversation phase
 * @returns {string} - Filler context type
 */
export function getFillerContext(userText, phase) {
    const normalized = userText.toLowerCase();

    // Empathy fillers for objections/concerns
    if (/not interested|too busy|no budget|happy with|don't have time/i.test(normalized)) {
        return 'empathy';
    }

    // Acknowledgment for answers to questions
    if (phase === 'discovery' || normalized.length > 30) {
        return 'acknowledgment';
    }

    // Transition when changing topics
    if (phase === 'pitch' || phase === 'consultative') {
        return Math.random() > 0.7 ? 'transition' : 'thinking';
    }

    // Default thinking filler
    return 'thinking';
}

/**
 * Build a complete filler + response
 * Prepend a short filler to the AI response for more natural flow
 */
export function addFillerToResponse(response, userText, phase) {
    // Don't add filler to very short responses
    if (response.length < 30) {
        return response;
    }

    // 40% chance to add a filler prefix for natural variation
    if (Math.random() > 0.4) {
        return response;
    }

    const context = getFillerContext(userText, phase);
    const filler = getFillerPhrase(context);

    // Avoid doubling if response already starts with similar word
    const responseStart = response.substring(0, 20).toLowerCase();
    const fillerWord = filler.split(' ')[0].toLowerCase().replace(/[.,!]/g, '');

    if (responseStart.includes(fillerWord)) {
        return response;
    }

    return `${filler} ${response}`;
}

export { FILLER_SOUNDS };
