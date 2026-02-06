/**
 * Utility script to create accounts for existing leads that have company names but no linked accounts
 *
 * Usage: npx tsx scripts/create-accounts-from-leads.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createAccountsFromLeads() {
  console.log('🔍 Finding leads with companies but no accounts...')

  // Find all leads that have a company but no accountId
  const leadsWithoutAccounts = await prisma.lead.findMany({
    where: {
      company: {
        not: null,
        not: '',
      },
      accountId: null,
    },
    select: {
      id: true,
      company: true,
      userId: true,
      companyId: true,
    },
  })

  console.log(`Found ${leadsWithoutAccounts.length} leads with companies but no accounts`)

  if (leadsWithoutAccounts.length === 0) {
    console.log('✅ All leads with companies already have accounts linked')
    return
  }

  // Group leads by company name (case-insensitive) and tenant
  const companiesMap = new Map<string, typeof leadsWithoutAccounts>()

  for (const lead of leadsWithoutAccounts) {
    const key = `${lead.company?.toLowerCase()}|${lead.companyId || lead.userId}`
    const existing = companiesMap.get(key) || []
    existing.push(lead)
    companiesMap.set(key, existing)
  }

  console.log(`📊 Found ${companiesMap.size} unique companies to create accounts for`)

  let accountsCreated = 0
  let leadsLinked = 0

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
        console.log(`📝 Creating account for: ${companyName}`)
        account = await prisma.account.create({
          data: {
            name: companyName,
            ...(firstLead.companyId ? { companyId: firstLead.companyId } : { ownerId: firstLead.userId }),
          },
        })
        accountsCreated++
      } else {
        console.log(`✓ Account already exists for: ${companyName}`)
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
      console.log(`✓ Linked ${leadIds.length} lead(s) to account: ${companyName}`)
    } catch (error) {
      console.error(`❌ Error processing company "${companyName}":`, error)
    }
  }

  console.log('\n✅ Account creation complete!')
  console.log(`📊 Summary:`)
  console.log(`   - Accounts created: ${accountsCreated}`)
  console.log(`   - Leads linked: ${leadsLinked}`)
  console.log(`   - Unique companies processed: ${companiesMap.size}`)
}

createAccountsFromLeads()
  .then(() => {
    console.log('\n🎉 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
