import prisma from '../lib/prisma.js';
import { getCompanies, getContacts, refreshAccessToken, getContactsInList } from '../hubspotClient.js';
import { enrichAccount } from './enrichment.js';


export const syncHubSpotAccount = async (companyId) => {
    console.log(`[HubSpot Sync] Starting sync for company ${companyId}`);

    // 1. Get Company Settings & Token
    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    if (!settings || !settings.hubspotConnected || !settings.hubspotRefreshToken) {
        console.error(`[HubSpot Sync] HubSpot not connected for company ${companyId}`);
        return;
    }

    let accessToken = settings.hubspotAccessToken;
    let expiresAt = settings.hubspotExpiresAt;

    // 2. Refresh Token if needed (buffer 5 mins)
    if (!accessToken || !expiresAt || new Date() > new Date(expiresAt.getTime() - 5 * 60000)) {
        console.log(`[HubSpot Sync] Refreshing token for company ${companyId}`);
        try {
            const tokens = await refreshAccessToken(settings.hubspotRefreshToken);
            accessToken = tokens.access_token;
            expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

            await prisma.companySettings.update({
                where: { companyId },
                data: {
                    hubspotAccessToken: accessToken,
                    hubspotRefreshToken: tokens.refresh_token, // Update if rotated
                    hubspotExpiresAt: expiresAt
                }
            });
        } catch (err) {
            console.error(`[HubSpot Sync] Token refresh failed:`, err);
            return;
        }
    }

    // 3. Sync Companies -> Accounts
    try {
        console.log(`[HubSpot Sync] Fetching companies...`);
        // TODO: support pagination (just fetching first page for MVP)
        const hubCompaniesRes = await getCompanies(accessToken, 100);
        const hubCompanies = hubCompaniesRes.results || [];

        for (const hc of hubCompanies) {
            const props = hc.properties;
            const domain = props.domain;
            const hubspotId = hc.id;

            if (!domain) continue;

            let accountId;

            const existingAccount = await prisma.account.findFirst({
                where: {
                    OR: [
                        { hubspotId: hubspotId },
                        { domain: domain, companyId: companyId }
                    ]
                }
            });

            if (existingAccount) {
                await prisma.account.update({
                    where: { id: existingAccount.id },
                    data: {
                        hubspotId: hubspotId,
                        name: props.name || domain,
                        industry: props.industry,
                        employeeCount: props.numberofemployees ? parseInt(props.numberofemployees) : null,
                        annualRevenue: props.annualrevenue,
                        location: [props.city, props.state, props.country].filter(Boolean).join(', '),
                        updatedAt: new Date()
                    }
                });
                accountId = existingAccount.id;
            } else {
                const newAccount = await prisma.account.create({
                    data: {
                        companyId: companyId,
                        hubspotId: hubspotId,
                        name: props.name || domain,
                        domain: domain,
                        industry: props.industry,
                        employeeCount: props.numberofemployees ? parseInt(props.numberofemployees) : null,
                        annualRevenue: props.annualrevenue,
                        location: [props.city, props.state, props.country].filter(Boolean).join(', '),
                        status: "prospect"
                    }
                });
                accountId = newAccount.id;
            }

            // Trigger Enrichment (Async - don't await blocking)
            enrichAccount(accountId).catch(err => console.error(`[HubSpot Sync] Enrichment failed for ${accountId}`, err));
        }
        console.log(`[HubSpot Sync] Processed ${hubCompanies.length} companies.`);

    } catch (err) {
        console.error(`[HubSpot Sync] Error syncing companies:`, err);
    }

    // 4. Sync Contacts -> Leads
    try {
        console.log(`[HubSpot Sync] Fetching contacts...`);
        const hubContactsRes = await getContacts(accessToken, 100);
        const hubContacts = hubContactsRes.results || [];

        for (const c of hubContacts) {
            const props = c.properties;
            const email = props.email;
            const hubspotId = c.id;

            if (!email || !props.firstname) continue;

            // Upsert Lead
            let existingLead = await prisma.lead.findFirst({
                where: {
                    companyId: companyId,
                    OR: [
                        { hubspotId: hubspotId },
                        { email: email }
                    ]
                }
            });

            if (existingLead) {
                await prisma.lead.update({
                    where: { id: existingLead.id },
                    data: {
                        hubspotId: hubspotId,
                        firstName: props.firstname,
                        lastName: props.lastname || '',
                        jobTitle: props.jobtitle,
                        phone: props.phone || props.mobilephone || existingLead.phone,
                        linkedinUrl: props.linkedin_profile || existingLead.linkedinUrl
                    }
                });
            } else {
                // Create new
                await prisma.lead.create({
                    data: {
                        companyId: companyId,
                        userId: (await getAdminUserId(companyId)) || 'UNKNOWN_USER',
                        hubspotId: hubspotId,
                        email: email,
                        firstName: props.firstname,
                        lastName: props.lastname || '',
                        phone: props.phone || props.mobilephone || '',
                        jobTitle: props.jobtitle,
                        linkedinUrl: props.linkedin_profile,
                        status: 'pending'
                    }
                });
            }
        }
        console.log(`[HubSpot Sync] Processed ${hubContacts.length} contacts.`);

    } catch (err) {
        console.error(`[HubSpot Sync] Error syncing contacts:`, err);
    }
};

// ... (existing code)

export const importFromList = async (companyId, listId) => {
    console.log(`[HubSpot Import] Starting import for list ${listId} (Company: ${companyId})`);

    // 1. Get Token
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    if (!settings?.hubspotAccessToken) throw new Error("HubSpot not connected");

    let accessToken = settings.hubspotAccessToken;
    // Refresh logic (simplified for brevity, usually should reuse common getToken function)
    if (settings.hubspotExpiresAt && new Date() > new Date(settings.hubspotExpiresAt.getTime() - 300000)) {
        const tokens = await refreshAccessToken(settings.hubspotRefreshToken);
        accessToken = tokens.access_token;
        // Update DB... (skipping for brevity, rely on main sync or extract token logic)
        await prisma.companySettings.update({
            where: { companyId },
            data: { hubspotAccessToken: tokens.access_token, hubspotExpiresAt: new Date(Date.now() + tokens.expires_in * 1000) }
        });
    }

    // 2. Fetch Contacts in List
    // TODO: Pagination
    const res = await getContactsInList(accessToken, listId, 100);
    const contacts = res.results || [];

    let importedCount = 0;

    for (const c of contacts) {
        const props = c.properties;
        if (!props.email) continue;

        // 3. Resolve Account (Company)
        // Note: The Search API contact object has 'company' property but it might just be the name.
        // To get the full Company object, we usually need to fetch associations. 
        // For MVP, we'll try to match by Domain if available in email, or create a placeholder account.

        let accountId;
        const emailDomain = props.email.split('@')[1];

        // Try to find Account by domain
        let account = await prisma.account.findFirst({
            where: {
                companyId,
                domain: { equals: emailDomain, mode: 'insensitive' }
            }
        });

        if (!account && emailDomain) {
            // Create Prospect Account
            account = await prisma.account.create({
                data: {
                    companyId,
                    name: props.company || emailDomain, // Fallback name
                    domain: emailDomain,
                    status: 'prospect'
                }
            });
            // Trigger enrichment for this new account
            enrichAccount(account.id).catch(console.error);
        }

        accountId = account?.id;

        // 4. Upsert Lead
        const leadData = {
            userId: (await getAdminUserId(companyId)) || 'UNKNOWN',
            hubspotId: c.id,
            email: props.email,
            firstName: props.firstname || '',
            lastName: props.lastname || '',
            jobTitle: props.jobtitle,
            phone: props.phone || props.mobilephone,
            linkedinUrl: props.linkedin_profile,
            status: 'pending',
            accountId: accountId
        };

        const existing = await prisma.lead.findFirst({
            where: { companyId, OR: [{ hubspotId: c.id }, { email: props.email }] }
        });

        if (existing) {
            await prisma.lead.update({ where: { id: existing.id }, data: leadData });
        } else {
            await prisma.lead.create({ data: { ...leadData, companyId } });
        }
        importedCount++;
    }

    return { imported: importedCount, total: contacts.length };
};

async function getAdminUserId(companyId) {
    const user = await prisma.user.findFirst({
        where: { companyId, role: 'admin' }
    });
    return user?.id;
}
