// Response Cache - Pre-cached responses for instant replies (0ms AI latency!)
// These common responses are used without calling the AI, dramatically reducing latency

/**
 * RAPPORT PHASE - Responses to initial greetings
 * When prospect says hi/hello/how are you, use these instead of AI
 */
const RAPPORT_RESPONSES = {
    // When they just say "hi" or "hello"
    greeting: [
        "Hey! Is this a good time for a quick chat?",
        "Hi there! Hope I'm not catching you at a bad time?",
        "Hey! Do you have a minute to chat?",
    ],

    // When they ask "how are you?"
    howAreYou: [
        "I'm doing great, thanks for asking! Is now a good time to chat?",
        "Doing well, thanks! Quick question - is this a good time?",
        "Great, thanks! Do you have a minute?",
    ],

    // When they say "yes" to permission
    yesPermission: [
        "Perfect! So I wanted to quickly ask - what tools are you using for IT service management today?",
        "Great! Quick question - what are you currently using for IT support?",
        "Awesome! What's your current setup for handling IT requests?",
    ],

    // When they say "who is this?" or "what company?"
    whoIsThis: [
        "This is {{voicePersona}} from Atomicwork - we help IT teams automate service management with AI. Is now a good time?",
    ],
};

/**
 * OBJECTION HANDLING - Quick responses to common objections
 */
const OBJECTION_RESPONSES = {
    // "Not interested"
    notInterested: [
        "Totally understand. Before I go - we're sending out a free State of AI report. Want me to email it over?",
        "No worries at all. Quick thing - we have a free report on AI trends. Worth a look?",
    ],

    // "We're happy with current solution"
    happyWithCurrent: [
        "Makes sense. Lots of folks we work with felt the same. What would make you consider alternatives?",
        "Got it. Out of curiosity, what do you like most about your current setup?",
    ],

    // "Send me an email"
    sendEmail: [
        "Happy to! What's the best email to reach you?",
        "For sure. Is {{leadEmail}} still the best one?",
    ],

    // "Too busy right now"
    tooBusy: [
        "Totally get it. When would be a better time to reconnect?",
        "No problem. Would next week work better for a quick 5-minute chat?",
    ],

    // "We don't have budget"
    noBudget: [
        "Hear you. Most companies see ROI in 3 months from ticket automation. Worth a quick demo to see the numbers?",
        "Understood. What if I could show you how this pays for itself?",
    ],

    // "Call me back later"
    callback: [
        "Sure thing. When's a good time? Morning or afternoon?",
        "No problem. What day works better for you?",
    ],
};

/**
 * CLOSING RESPONSES - End the call gracefully
 */
const CLOSING_RESPONSES = {
    // They agreed to demo
    agreedDemo: [
        "Perfect — I'll send over some times. Talk soon!",
        "Great! I'll email you some options. Looking forward to it!",
        "Awesome! You'll get a calendar invite shortly. Have a great day!",
    ],

    // They want to be removed
    optOut: [
        "Understood — I'll take you off our list. Sorry for the interruption.",
        "No problem at all. You won't hear from us again. Take care!",
    ],

    // General positive close
    positiveClose: [
        "Thanks for your time! Talk soon.",
        "Appreciate you chatting with me. Have a great day!",
        "Great talking with you. Take care!",
    ],
};

/**
 * Get a cached response if the input matches a known pattern
 * Returns null if no cached response matches (fall through to AI)
 * 
 * @param {string} input - User's speech input
 * @param {string} phase - Current conversation phase
 * @param {object} context - Additional context (leadEmail, voicePersona, etc.)
 * @returns {string|null} - Cached response or null
 */
export function getCachedResponse(input, phase, context = {}) {
    const normalized = input.toLowerCase().trim();
    const { voicePersona = 'Alex', leadEmail = '' } = context;

    // ===== RAPPORT PHASE =====
    if (phase === 'rapport') {
        // "hi" or "hello" variations
        if (/^(hi|hello|hey|hiya|howdy|good morning|good afternoon|good evening)[,!.]*$/i.test(normalized)) {
            return randomPick(RAPPORT_RESPONSES.greeting);
        }

        // "how are you?" variations
        if (/how (are|r) (you|u)|how('s| is) it going|what's up/i.test(normalized)) {
            return randomPick(RAPPORT_RESPONSES.howAreYou);
        }

        // "yes" to permission - move to discovery
        if (/^(yes|yeah|yep|sure|ok|okay|go ahead|tell me|shoot|alright|fine)/i.test(normalized) && normalized.length < 20) {
            return randomPick(RAPPORT_RESPONSES.yesPermission);
        }

        // "who is this?"
        if (/who (is|are) (this|you)|what company|where (are|r) you (from|calling)/i.test(normalized)) {
            return randomPick(RAPPORT_RESPONSES.whoIsThis).replace('{{voicePersona}}', voicePersona);
        }
    }

    // ===== OBJECTION HANDLING =====
    // "not interested"
    if (/not interested|no thanks|no thank you|not for (me|us)|pass/i.test(normalized)) {
        return randomPick(OBJECTION_RESPONSES.notInterested);
    }

    // "we're happy with current solution"
    if (/happy with|satisfied with|good with|already have|using .+ already/i.test(normalized)) {
        return randomPick(OBJECTION_RESPONSES.happyWithCurrent);
    }

    // "send me an email"
    if (/send (me )?(an )?email|email me|just email/i.test(normalized)) {
        const response = randomPick(OBJECTION_RESPONSES.sendEmail);
        return response.replace('{{leadEmail}}', leadEmail || 'the email I have on file');
    }

    // "too busy"
    if (/too busy|busy right now|in a meeting|bad time|can('t| not) talk/i.test(normalized)) {
        return randomPick(OBJECTION_RESPONSES.tooBusy);
    }

    // "no budget"
    if (/no budget|don't have (the )?budget|can't afford|too expensive/i.test(normalized)) {
        return randomPick(OBJECTION_RESPONSES.noBudget);
    }

    // "call me back"
    if (/call (me )?(back|later)|try (again )?(later|another time)/i.test(normalized)) {
        return randomPick(OBJECTION_RESPONSES.callback);
    }

    // ===== CLOSING =====
    // Positive acknowledgment at end ("yes" "sure" "sounds good" after pitch)
    if (phase === 'closing' || phase === 'email_capture') {
        if (/^(yes|yeah|sure|sounds good|that works|perfect|great)[.!]*$/i.test(normalized)) {
            return randomPick(CLOSING_RESPONSES.agreedDemo);
        }
    }

    // No cached response - fall through to AI
    return null;
}

/**
 * Pick a random response from an array
 */
function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Check if input likely needs AI (complex question or unknown pattern)
 */
export function needsAI(input, phase) {
    const normalized = input.toLowerCase();

    // Always use AI for discovery/consultative phases (need context)
    if (['discovery', 'consultative', 'pitch'].includes(phase)) {
        // But allow cached objection handling
        if (/not interested|happy with|send.*email|too busy|no budget|call.*back/i.test(normalized)) {
            return false;
        }
        return true;
    }

    // Questions always need AI
    if (normalized.includes('?') || /what|how|why|when|where|who|can you|do you/i.test(normalized)) {
        // Exception: "how are you" is cached
        if (/how (are|r) (you|u)/i.test(normalized)) {
            return false;
        }
        return true;
    }

    // Long responses likely need AI understanding
    if (normalized.split(' ').length > 15) {
        return true;
    }

    return false;
}

export { RAPPORT_RESPONSES, OBJECTION_RESPONSES, CLOSING_RESPONSES };
