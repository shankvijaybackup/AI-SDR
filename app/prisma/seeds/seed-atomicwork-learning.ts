// Seed script for Atomicwork Learning Agent
// Run with: npx prisma db seed
// Add this to package.json:
// "prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seeds/seed-atomicwork-learning.ts" }

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBattlecards() {
    console.log('🗡️ Seeding Battlecards...');

    const battlecards = [
        {
            competitorName: 'ServiceNow',
            overview: 'Enterprise ITSM incumbent with deep customization but complex implementation.',
            strengths: ['Enterprise scale', 'Deep customization', 'Broad ecosystem', 'Strong brand'],
            weaknesses: ['Slow deployment', 'Expensive', 'Poor UX', 'High maintenance'],
            pricing: '$100-200/agent/month + $500K-2M implementation',
            killPoints: ['Speed to value', 'Modern UX', 'AI-native'],
            whenTheyWin: [
                'Complex enterprise with 10,000+ employees',
                'Heavy customization requirements',
                'Existing ServiceNow footprint'
            ],
            whenWeWin: [
                'Speed to value is critical',
                'AI-first approach is priority',
                'Modern UX matters'
            ],
            landmines: [
                'Never say ServiceNow is too expensive',
                'Avoid direct feature comparisons'
            ],
            positioning: [
                'Frame as MODERN vs LEGACY',
                'Emphasize AI-NATIVE architecture'
            ],
            discoveryQuestions: [
                'How long did your last ServiceNow implementation take?',
                'What percentage of requests are still handled manually?'
            ],
            whyChange: 'ServiceNow was built in 2004 for a different era. Today\'s employees expect consumer-grade experiences.',
            nextSteps: [
                'Request a specific pain point POC',
                'Propose a parallel evaluation during renewal'
            ]
        },
        {
            competitorName: 'Jira Service Management',
            overview: 'Developer-focused ITSM with strong Atlassian integration.',
            strengths: ['Developer familiarity', 'Atlassian ecosystem', 'Lower cost', 'Good for DevOps'],
            weaknesses: ['Limited ITSM depth', 'Weak AI', 'Scaling challenges', 'Complex for non-tech'],
            pricing: '$20-50/agent/month',
            killPoints: ['Enterprise ITSM features', 'AI automation', 'Non-technical user experience'],
            whenTheyWin: [
                'Dev-heavy organization',
                'Already in Atlassian ecosystem',
                'Budget-constrained'
            ],
            whenWeWin: [
                'Enterprise ITSM requirements',
                'Non-technical stakeholders involved',
                'AI automation is priority'
            ],
            landmines: [
                'Don\'t position as replacement for Jira Software',
                'Avoid pricing war'
            ],
            positioning: [
                'Position as enterprise-grade vs team tool',
                'Focus on employee experience'
            ],
            discoveryQuestions: [
                'How do non-technical employees interact with Jira today?',
                'What\'s your automation rate for common requests?'
            ],
            whyChange: 'Jira SM is great for dev teams but struggles with enterprise ITSM and employee experience.',
            nextSteps: [
                'Demo employee-facing experience',
                'Show AI automation capabilities'
            ]
        },
        {
            competitorName: 'Freshservice',
            overview: 'SMB-focused ITSM with good UX but limited enterprise features.',
            strengths: ['Easy to use', 'Quick deployment', 'Good value', 'Modern interface'],
            weaknesses: ['Limited enterprise features', 'Basic AI', 'Scaling concerns', 'Fewer integrations'],
            pricing: '$30-80/agent/month',
            killPoints: ['Enterprise scale', 'Advanced AI', 'Multi-department platform'],
            whenTheyWin: [
                'SMB or mid-market company',
                'Simple ITSM needs',
                'Limited budget'
            ],
            whenWeWin: [
                'Growth trajectory needs enterprise capabilities',
                'Multi-department needs (IT + HR + Finance)',
                'AI-first strategy'
            ],
            landmines: [
                'Don\'t dismiss their UX - it\'s actually good',
                'Avoid disparaging their brand'
            ],
            positioning: [
                'Position as the platform you grow into',
                'Focus on AI and multi-department'
            ],
            discoveryQuestions: [
                'How will your ITSM needs change as you grow?',
                'Are HR and Finance using separate tools?'
            ],
            whyChange: 'Freshservice works for simple use cases but hits limits as you scale or expand beyond IT.',
            nextSteps: [
                'Show unified IT + HR demo',
                'Present growth case study'
            ]
        },
        {
            competitorName: 'Zendesk',
            overview: 'Customer service leader expanding into employee service.',
            strengths: ['Great UX', 'Omnichannel', 'Fast deployment', 'Strong brand'],
            weaknesses: ['Not built for ITSM', 'Limited ITIL', 'Security concerns', 'No asset management'],
            pricing: '$50-150/agent/month',
            killPoints: ['True ITSM capabilities', 'IT-specific features', 'Enterprise security'],
            whenTheyWin: [
                'Customer service team driving decision',
                'Simple employee helpdesk needs',
                'Already using Zendesk for customers'
            ],
            whenWeWin: [
                'True ITSM requirements',
                'IT leadership involved',
                'Security/compliance focus'
            ],
            landmines: [
                'Don\'t say they\'re not a real ITSM tool - be diplomatic',
                'Acknowledge their UX strength'
            ],
            positioning: [
                'Position as purpose-built for IT',
                'Emphasize ITSM-specific capabilities'
            ],
            discoveryQuestions: [
                'Do you need asset management?',
                'What are your ITIL compliance requirements?'
            ],
            whyChange: 'Zendesk is excellent for customer service but lacks the ITSM depth enterprises need.',
            nextSteps: [
                'Demo ITSM-specific features',
                'Compare security & compliance'
            ]
        }
    ];

    for (const card of battlecards) {
        await prisma.battlecard.upsert({
            where: {
                id: card.competitorName.toLowerCase().replace(/\s+/g, '-')
            },
            update: card,
            create: {
                id: card.competitorName.toLowerCase().replace(/\s+/g, '-'),
                ...card
            }
        });
    }

    console.log(`✅ Seeded ${battlecards.length} battlecards`);
}

async function seedPitchTemplates() {
    console.log('🎤 Seeding Pitch Templates...');

    const templates = [
        {
            title: 'Elevator Pitch',
            duration: '30sec',
            salesStage: 'INTRO',
            targetPersona: 'AE',
            opening: {
                short: "Atomicwork is an AI-native service management platform that helps enterprises automate IT, HR, and Finance support—reducing ticket volume by 60% while improving employee experience.",
                expanded: "Hi, I'm [Name] from Atomicwork. We're solving a problem that every growing company faces: employees hate submitting tickets, and IT teams are drowning in repetitive requests. Our AI-native platform automates 60% of support requests through conversational AI, while giving you a modern, unified platform for IT, HR, and Finance. The best part? We deploy in weeks, not months."
            }
        },
        {
            title: 'Cold Call Opener',
            duration: '2min',
            salesStage: 'INTRO',
            targetPersona: 'AE',
            opening: {
                short: "I noticed [Company] is growing fast. That usually means your IT team is getting crushed with requests. We help companies like yours automate 60% of IT tickets with AI.",
                expanded: "Hi [Name], this is [Your Name] from Atomicwork. I'll be brief—I noticed [Company] has been growing rapidly, and in my experience, that means your IT team is probably getting crushed with employee requests. Password resets, access requests, onboarding—the routine stuff that eats up time.\n\nWe've been helping companies like [similar company] automate 60% of those tickets with conversational AI. They went from 2-day resolution times to instant for most requests.\n\nI don't want to assume this is a problem for you—but if it is, would it make sense to have a 15-minute conversation about how we're doing this?"
            },
            narrative: {
                core: "We believe the way employees get help at work is fundamentally broken. They shouldn't have to navigate complex portals or wait days for simple requests.",
                proofPoints: [
                    "65% automation rate for routine IT requests",
                    "90% employee satisfaction with AI assistant"
                ]
            }
        },
        {
            title: 'Executive Brief',
            duration: '10min',
            salesStage: 'INTRO',
            targetPersona: 'AE',
            opening: {
                short: "Thank you for your time. Before we begin, what's driving your evaluation of new service management solutions?",
                expanded: "Thank you for taking the time today. I've done some research on [Company], and I'm genuinely excited about this conversation.\n\nBefore I share what we're doing at Atomicwork, I'd love to understand: what's specifically driving your evaluation of new service management solutions right now? Is there a particular pain point or initiative that's top of mind?"
            },
            discovery: {
                questions: [
                    "What's your current ticket volume per month?",
                    "How long does a typical resolution take?",
                    "What percentage of requests are routine vs. complex?"
                ],
                flow: "Pain → Impact → Urgency → Decision process"
            },
            narrative: {
                core: "Atomicwork is an AI-native enterprise service management platform. Unlike legacy tools that bolted AI onto 20-year-old architecture, we built from the ground up for the age of AI.\n\nThree things make us different:\n1. AI-First: Conversational automation for 60%+ of requests\n2. Unified Platform: IT, HR, and Finance on one backbone\n3. Speed: Deploy in weeks, not months",
                proofPoints: [
                    "45% reduction in MTTR",
                    "65% of tickets automated",
                    "4.8/5 employee satisfaction"
                ]
            },
            closing: {
                short: "Based on what you've shared, I think a focused pilot on [use case] would show value quickly. Can we schedule a technical session to define scope?",
                expanded: "Based on our conversation, it sounds like [PAIN POINT] is costing you [IMPACT]. Here's what I'd recommend:\n\n1. This week: I'll send you a custom ROI analysis\n2. Next week: Technical deep-dive with your architect\n3. Following 30 days: Focused pilot on [USE CASE]\n\nDoes this approach work for you?"
            }
        }
    ];

    for (const template of templates) {
        await prisma.pitchTemplate.create({
            data: template as any
        });
    }

    console.log(`✅ Seeded ${templates.length} pitch templates`);
}

async function main() {
    console.log('🌱 Starting Atomicwork Learning Agent seed...\n');

    await seedBattlecards();
    await seedPitchTemplates();

    console.log('\n✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
