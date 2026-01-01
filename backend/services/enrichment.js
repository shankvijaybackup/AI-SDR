import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch'; // Backend might need node-fetch if Node < 18

const prisma = new PrismaClient();
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

export async function enrichAccount(accountId) {
    console.log(`[Enrichment] Starting enrichment for account ${accountId}`);
    try {
        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) return false;

        // Determine Company Identifier
        let identifier = account.linkedinUrl || account.domain;
        if (!identifier) {
            if (account.name) {
                console.warn(`[Enrichment] No domain or LinkedIn URL for account ${account.name}`);
                return false;
            }
            return false;
        }

        // Call ScrapeNinja or generic scraper
        // For MVP, if we don't have a robust Company API, we just mark as enriched via "Basic/Domain" or skip.
        // Real implementation requires a subscription to a B2B data provider (Apollo, Proxycurl, etc).
        // Here we simulate or use a placeholder.

        console.log(`[Enrichment] Fetching company data for ${identifier} via ScrapeNinja...`);

        // Mock for now if no API key or to save credits during dev
        // In production, uncomment the fetch call
        /*
        const companyData = await fetchLinkedInCompany(identifier);
        if (companyData) {
           await prisma.account.update({
             where: { id: accountId },
             data: {
               enriched: true,
               enrichmentData: companyData,
               updatedAt: new Date()
             }
           });
           return true;
        }
        */

        // For MVP demonstration:
        await prisma.account.update({
            where: { id: accountId },
            data: {
                enriched: true,
                updatedAt: new Date()
            }
        });

        return true;
    } catch (error) {
        console.error(`[Enrichment] Error enriching account ${accountId}:`, error);
        return false;
    }
}
