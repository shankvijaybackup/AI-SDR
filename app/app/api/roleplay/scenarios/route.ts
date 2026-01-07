
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const count = await prisma.roleplayScenario.count();

    if (count === 0) {
        const defaults = [
            {
                title: "Discovery Call with Skeptical CTO",
                description: "Structure a discovery call with a technical buyer who doubts AI ROI.",
                personaName: "Marcus Chen",
                personaRole: "CTO",
                difficulty: "hard",
                objectives: ["Uncover technical pain points", "Address security concerns", "Schedule technical demo"]
            },
            {
                title: "Renewal Negotiation with Procurement",
                description: "Handle a tough renewal conversation where budget is being cut.",
                personaName: "Sarah Jones",
                personaRole: "Procurement Manager",
                difficulty: "medium",
                objectives: ["Defend pricing", "Highlight usage value", "Secure annual commit"]
            },
            {
                title: "Inbound Lead Qualification",
                description: "Qualify an inbound lead who visited the pricing page.",
                personaName: "David Miller",
                personaRole: "VP of Sales",
                difficulty: "easy",
                objectives: ["BANT Qualification", "Identify decision process", "Book meeting"]
            }
        ];

        for (const s of defaults) {
            await prisma.roleplayScenario.create({ data: s });
        }
    }

    const scenarios = await prisma.roleplayScenario.findMany();
    return NextResponse.json({ scenarios });
} catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
}
}
