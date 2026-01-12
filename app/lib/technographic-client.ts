import { prisma } from './prisma'

const TECHNOGRAPHIC_SERVICE_URL = process.env.TECHNOGRAPHIC_SERVICE_URL || 'http://localhost:8000';

interface TechnographicResult {
    status: string;
    company: string;
    technographics: Array<{
        tech_name: string;
        category: string;
        confidence: string;
        evidence: string;
    }>;
}

export async function performTechnographicEnrichment(accountId: string): Promise<boolean> {
    console.log(`[Technographic] Starting enrichment for Account ID: ${accountId}`);

    try {
        // 1. Get Account Domain
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: { id: true, domain: true, name: true }
        });

        if (!account || !account.domain) {
            console.warn(`[Technographic] Skipped: No domain for account ${account?.name}`);
            return false;
        }

        // 2. Call Python Service
        console.log(`[Technographic] Calling Python Service for domain: ${account.domain}`);
        const response = await fetch(`${TECHNOGRAPHIC_SERVICE_URL}/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_domain: account.domain })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Technographic] API Error: ${response.status} - ${errorText}`);
            return false;
        }

        const data: TechnographicResult = await response.json();

        if (data.status !== 'success') {
            console.warn(`[Technographic] API returned non-success status: ${data.status}`);
            return false;
        }

        // 3. Update Database
        console.log(`[Technographic] Found ${data.technographics.length} technologies. Updating DB...`);

        // Transform flat array into Category -> Tech list map
        const groupedTechnographics: Record<string, string[]> = {};

        data.technographics.forEach(tech => {
            const category = tech.category || 'Uncategorized';
            if (!groupedTechnographics[category]) {
                groupedTechnographics[category] = [];
            }
            if (!groupedTechnographics[category].includes(tech.tech_name)) {
                groupedTechnographics[category].push(tech.tech_name);
            }
        });

        await prisma.account.update({
            where: { id: accountId },
            data: {
                technographics: groupedTechnographics as any, // stored as JSON
                technographicEnriched: true,
                lastEnrichedAt: new Date()
            }
        });

        return true;

    } catch (error) {
        console.error('[Technographic] Exception during enrichment:', error);
        return false;
    }
}
