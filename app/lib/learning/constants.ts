// Atomicwork Learning Agent - Core Constants

// ==================== SALES PERSONAS ====================

export const SALES_PERSONAS = {
    AE: {
        name: "Account Executive",
        shortName: "AE",
        focus: "Value articulation, deal progression",
        emphasis: "Business outcomes, ROI, executive messaging",
        color: "blue"
    },
    SC: {
        name: "Solutions Consultant",
        shortName: "SC",
        focus: "Technical depth, demo excellence",
        emphasis: "Architecture, integrations, use cases",
        color: "purple"
    },
    PARTNER: {
        name: "Partner",
        shortName: "Partner",
        focus: "Multi-vendor positioning, co-sell",
        emphasis: "Partner economics, implementation scope",
        color: "green"
    }
} as const;

export type SalesPersona = keyof typeof SALES_PERSONAS;

// ==================== PITCH DURATIONS ====================

export const PITCH_DURATIONS = {
    "30sec": {
        label: "Elevator Pitch",
        scenario: "Networking, quick intro",
        minutes: 0.5,
        sections: ["opening"]
    },
    "2min": {
        label: "Cold Call",
        scenario: "Quick intro, generate interest",
        minutes: 2,
        sections: ["opening", "narrative"]
    },
    "10min": {
        label: "Executive Brief",
        scenario: "Core narrative + 1-2 proof points",
        minutes: 10,
        sections: ["opening", "narrative", "closing"]
    },
    "30min": {
        label: "Discovery Meeting",
        scenario: "Full discovery + initial positioning",
        minutes: 30,
        sections: ["opening", "discovery", "narrative", "closing"]
    },
    "45min": {
        label: "Standard Demo",
        scenario: "Discovery + demo + objection handling",
        minutes: 45,
        sections: ["opening", "discovery", "narrative", "demo", "objectionHandling", "closing"]
    },
    "90min": {
        label: "Deep Dive",
        scenario: "Full technical validation",
        minutes: 90,
        sections: ["opening", "discovery", "narrative", "demo", "objectionHandling", "closing"]
    }
} as const;

export type PitchDuration = keyof typeof PITCH_DURATIONS;

// ==================== SALES STAGES ====================

export const SALES_STAGES = {
    INTRO: {
        label: "Introduction",
        description: "Hook, first impression",
        icon: "Handshake"
    },
    DISCOVERY: {
        label: "Discovery",
        description: "Questions to ask, pain points to uncover",
        icon: "Search"
    },
    DEMO: {
        label: "Demo",
        description: "Show value, key moments",
        icon: "Presentation"
    },
    OBJECTIONS: {
        label: "Objection Handling",
        description: "Handle pushback, concerns",
        icon: "Shield"
    },
    CLOSING: {
        label: "Closing",
        description: "Next steps, commitments",
        icon: "CheckCircle"
    },
    COMPETITION: {
        label: "Competitive",
        description: "Defend position against competitors",
        icon: "Swords"
    }
} as const;

export type SalesStage = keyof typeof SALES_STAGES;

// ==================== BUYER PERSONAS (Practice Mode) ====================

export const BUYER_PERSONAS = [
    {
        id: "service_desk_manager",
        name: "Service Desk Manager",
        role: "Manager",
        focus: "Day-to-day operations, metrics, team efficiency",
        difficulty: "easy",
        difficultyLevel: 1,
        traits: ["Practical", "Metric-focused", "Time-constrained"],
        concerns: ["MTTR", "Ticket volume", "Agent productivity"]
    },
    {
        id: "it_director",
        name: "IT Director",
        role: "Director",
        focus: "Operations, TCO, productivity gains",
        difficulty: "medium",
        difficultyLevel: 2,
        traits: ["Strategic", "Budget-conscious", "Risk-aware"],
        concerns: ["TCO", "Integration complexity", "Change management"]
    },
    {
        id: "employee_experience",
        name: "Employee Experience Owner",
        role: "VP/Director",
        focus: "Employee satisfaction, adoption, digital workplace",
        difficulty: "medium",
        difficultyLevel: 2,
        traits: ["People-focused", "Adoption-conscious", "UX-sensitive"],
        concerns: ["Adoption rates", "Employee satisfaction", "Self-service"]
    },
    {
        id: "vp_it",
        name: "VP of IT",
        role: "VP",
        focus: "Strategy, transformation, business alignment",
        difficulty: "hard",
        difficultyLevel: 3,
        traits: ["Visionary", "Transformation-focused", "Board-facing"],
        concerns: ["Digital transformation", "Business impact", "Competitive advantage"]
    },
    {
        id: "procurement",
        name: "Procurement Officer",
        role: "Procurement",
        focus: "Pricing, contracts, vendor management",
        difficulty: "hard",
        difficultyLevel: 3,
        traits: ["Analytical", "Negotiation-focused", "Risk-averse"],
        concerns: ["Pricing transparency", "Contract terms", "Vendor lock-in"]
    },
    {
        id: "cio",
        name: "CIO",
        role: "C-Level",
        focus: "Enterprise strategy, risk, innovation",
        difficulty: "expert",
        difficultyLevel: 4,
        traits: ["Strategic", "Board-facing", "Future-focused"],
        concerns: ["Enterprise architecture", "Security/compliance", "Innovation agenda"]
    }
] as const;

export type BuyerPersona = typeof BUYER_PERSONAS[number];

// ==================== ONBOARDING PHASES ====================

export const ONBOARDING_PHASES = {
    foundation: {
        label: "Foundation",
        days: "0-30",
        weeks: [1, 2, 3, 4],
        focus: "Platform, ICP, baseline pitch",
        successCriteria: ["Pass foundation quiz (>80%)", "Deliver 10-min pitch"]
    },
    mastery: {
        label: "Mastery",
        days: "31-60",
        weeks: [5, 6, 7, 8],
        focus: "Discovery, demo, competitive",
        successCriteria: ["Complete mock demos (>3)", "Battlecard proficiency"]
    },
    execution: {
        label: "Execution",
        days: "61-90",
        weeks: [9, 10, 11, 12],
        focus: "Deal execution, advanced objections",
        successCriteria: ["Shadow deals (>2)", "Partner motion readiness"]
    }
} as const;

export type OnboardingPhase = keyof typeof ONBOARDING_PHASES;

// ==================== COACHING METRICS ====================

export const COACHING_METRICS = {
    clarity: {
        label: "Clarity",
        description: "How clear and understandable was the response",
        weight: 0.3
    },
    structure: {
        label: "Structure",
        description: "Logical flow and organization of points",
        weight: 0.3
    },
    valueArticulation: {
        label: "Value Articulation",
        description: "Effectively communicated business value",
        weight: 0.4
    }
} as const;

// ==================== ATOMICWORK KNOWLEDGE BASE ====================

export const ATOMICWORK_CORE = {
    company: "Atomicwork",
    tagline: "The Modern Enterprise Service Management Platform",
    elevator: "Atomicwork is an AI-native service management platform that automates IT, HR, and Finance support through intelligent virtual agents.",
    keyDifferentiators: [
        "AI-native architecture (not bolted-on AI)",
        "Modern, consumer-grade UX",
        "Unified platform for IT, HR, Finance",
        "10x faster implementation than legacy tools",
        "No-code workflow automation"
    ],
    icp: {
        companySize: "500-10,000 employees",
        industries: ["Technology", "Financial Services", "Healthcare", "Retail"],
        painPoints: [
            "Legacy ITSM tools are expensive and complex",
            "Poor employee experience with current tools",
            "High ticket volumes and slow resolution times",
            "Siloed IT, HR, Finance service desks"
        ]
    },
    competitors: ["ServiceNow", "Jira Service Management", "Freshservice", "Zendesk"]
};
