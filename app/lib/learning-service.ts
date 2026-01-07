
import { prisma } from "./prisma";

// Default Onboarding Plans
const DEFAULT_PATHS = [
    {
        title: "Account Executive (AE) Onboarding - 30-60-90",
        role: "AE",
        description: "Fast-track to revenue. Master the pitch, the product, and the process.",
        modules: [
            // 30 Days
            { title: "Day 1: Company Mission & Values", type: "document", orderIndex: 1, content: "Read the Employee Handbook." },
            { title: "Week 1: CRM CRM Certification", type: "video", orderIndex: 2, content: "Watch HubSpot/Salesforce training." },
            { title: "Month 1: Value Proposition Certification", type: "quiz", orderIndex: 3, content: "Pass the Value Prop Quiz." },
            // 60 Days
            { title: "Month 2: Mock Discovery Call", type: "roleplay", orderIndex: 4, content: "Complete AI Roleplay: 'Skeptical Buyer'." },
            { title: "Month 2: Competitor Battlecards", type: "document", orderIndex: 5, content: "Review 'Us vs. Them' battlecards." },
            // 90 Days
            { title: "Month 3: First Live Demo Shadow", type: "task", orderIndex: 6, content: "Shadow a Senior AE and write a summary." },
            { title: "Month 3: Final Certification", type: "quiz", orderIndex: 7, content: "Pass the comprehensive product exam." },
        ]
    },
    {
        title: "Sales Engineer (SE) Bootcamp",
        role: "SE",
        description: "Technical mastery. Deep dive into architecture, APIs, and demos.",
        modules: [
            { title: "Week 1: Architecture Overview", type: "video", orderIndex: 1, content: "System Design Deep Dive." },
            { title: "Month 1: API Implementation Challenge", type: "task", orderIndex: 2, content: "Build a sample integration using our API." },
            { title: "Month 2: Demo Certification (Standard)", type: "roleplay", orderIndex: 3, content: "Deliver standard demo to AI Persona." },
            { title: "Month 3: Advanced Objection Handling", type: "roleplay", orderIndex: 4, content: "Handle 'Security & Compliance' objections." },
        ]
    },
    {
        title: "Partner Enablement Program",
        role: "Partner",
        description: "Sell with us. Learn the joint value prop and deal registration.",
        modules: [
            { title: "Welcome: Partner Program Overview", type: "document", orderIndex: 1, content: "Read the Program Guide." },
            { title: "Deal Registration Portal Training", type: "video", orderIndex: 2, content: "How to register leads." },
            { title: "Joint Value Proposition", type: "document", orderIndex: 3, content: "Co-selling deck." },
        ]
    }
];

export async function seedLearningPaths(userId: string) {
    try {
        console.log("Seeding Learning Paths...");

        // Check if paths exist already to avoid duplicates (naive check by title)
        const existing = await prisma.learningPath.findFirst();
        if (existing) {
            console.log("Paths already seeded.");
            return;
        }

        // Get company ID from user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.companyId) throw new Error("User or Company not found");

        for (const plan of DEFAULT_PATHS) {
            await prisma.learningPath.create({
                data: {
                    companyId: user.companyId,
                    title: plan.title,
                    description: plan.description,
                    targetRole: plan.role,
                    modules: {
                        create: plan.modules.map(m => ({
                            title: m.title,
                            type: m.type,
                            orderIndex: m.orderIndex,
                            textContent: m.content
                        }))
                    }
                }
            });
        }
        console.log("Seeding Complete.");
    } catch (e) {
        console.error("Failed to seed paths", e);
        throw e;
    }
}

export async function getLearningPaths(userId: string) {
    // Return all paths available to the user's company
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.companyId) return [];

    return await prisma.learningPath.findMany({
        where: { companyId: user.companyId },
        include: {
            modules: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    progress: {
                        where: { userId }
                    }
                }
            }
        }
    });
}

export async function updateModuleProgress(userId: string, moduleId: string, status: string) {
    return await prisma.userLearningProgress.upsert({
        where: {
            userId_moduleId: { userId, moduleId }
        },
        update: {
            status,
            completedAt: status === 'completed' ? new Date() : null
        },
        create: {
            userId,
            moduleId,
            status,
            completedAt: status === 'completed' ? new Date() : null
        }
    });
}
