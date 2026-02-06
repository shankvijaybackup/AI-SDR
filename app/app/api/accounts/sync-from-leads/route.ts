import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

/**
 * POST /api/accounts/sync-from-leads
 *
 * Creates accounts for all leads that have company names but no linked accounts.
 * This is useful for retroactively creating accounts for existing leads.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('[Sync Accounts] Starting account sync from leads...')

    // Build where clause based on user's tenant
    const whereClause: any = {
      company: {
        not: null,
        not: '',
      },
      accountId: null,
    }

    if (currentUser.companyId) {
      whereClause.companyId = currentUser.companyId
    } else {
      whereClause.userId = currentUser.userId
    }

    // Find all leads that have a company but no accountId
    const leadsWithoutAccounts = await prisma.lead.findMany({
      where: whereClause,
      select: {
        id: true,
        company: true,
        userId: true,
        companyId: true,
      },
    })

    console.log(`[Sync Accounts] Found ${leadsWithoutAccounts.length} leads with companies but no accounts`)

    if (leadsWithoutAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All leads with companies already have accounts linked',
        accountsCreated: 0,
        leadsLinked: 0,
      })
    }

    // Group leads by company name (case-insensitive) and tenant
    const companiesMap = new Map<string, typeof leadsWithoutAccounts>()

    for (const lead of leadsWithoutAccounts) {
      const key = `${lead.company?.toLowerCase()}|${lead.companyId || lead.userId}`
      const existing = companiesMap.get(key) || []
      existing.push(lead)
      companiesMap.set(key, existing)
    }

    console.log(`[Sync Accounts] Found ${companiesMap.size} unique companies to create accounts for`)

    let accountsCreated = 0
    let leadsLinked = 0
    const errors: string[] = []

    // Create accounts and link leads
    for (const [key, leads] of companiesMap.entries()) {
      const firstLead = leads[0]
      const companyName = firstLead.company!

      try {
        // Check if account already exists for this company
        let account = await prisma.account.findFirst({
          where: {
            name: {
              equals: companyName,
              mode: 'insensitive',
            },
            ...(firstLead.companyId ? { companyId: firstLead.companyId } : { ownerId: firstLead.userId }),
          },
        })

        // Create account if it doesn't exist
        if (!account) {
          console.log(`[Sync Accounts] Creating account for: ${companyName}`)
          account = await prisma.account.create({
            data: {
              name: companyName,
              ...(firstLead.companyId ? { companyId: firstLead.companyId } : { ownerId: firstLead.userId }),
            },
          })
          accountsCreated++
        } else {
          console.log(`[Sync Accounts] Account already exists for: ${companyName}`)
        }

        // Link all leads to this account
        const leadIds = leads.map(l => l.id)
        await prisma.lead.updateMany({
          where: {
            id: {
              in: leadIds,
            },
          },
          data: {
            accountId: account.id,
          },
        })

        leadsLinked += leadIds.length
        console.log(`[Sync Accounts] Linked ${leadIds.length} lead(s) to account: ${companyName}`)
      } catch (error) {
        const errorMsg = `Error processing company "${companyName}": ${error instanceof Error ? error.message : String(error)}`
        console.error(`[Sync Accounts] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    console.log('[Sync Accounts] Account sync complete!')
    console.log(`[Sync Accounts] Summary: ${accountsCreated} accounts created, ${leadsLinked} leads linked`)

    return NextResponse.json({
      success: true,
      message: 'Account sync completed',
      accountsCreated,
      leadsLinked,
      uniqueCompanies: companiesMap.size,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[Sync Accounts] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
