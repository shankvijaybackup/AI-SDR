import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { parseCSV } from '@/lib/csv-parser'
import { enrichLead } from '@/lib/linkedin-enrichment'

interface ColumnMapping {
  [csvColumn: string]: string | null
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const autoEnrich = formData.get('autoEnrich') === 'true'
    const columnMappingStr = formData.get('columnMapping') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Parse column mapping
    let columnMapping: ColumnMapping = {}
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr)
      } catch {
        return NextResponse.json({ error: 'Invalid column mapping' }, { status: 400 })
      }
    }

    const csvText = await file.text()
    const rows = parseCSV(csvText)

    console.log(`[Import] Parsed ${rows.length} rows, Header: ${rows[0]?.join(',')}`)

    if (rows.length < 2) {
      console.log('[Import] CSV empty (rows < 2)')
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    const headers = rows[0]
    const dataRows = rows.slice(1)

    // ... (rest of transformation logic)

    console.log(`[Import] Transformed ${transformedLeads.length} valid leads. Errors: ${errors.length}`)
    if (errors.length > 0) console.log(`[Import] First error: ${JSON.stringify(errors[0])}`)

    if (transformedLeads.length === 0) {
      console.log('[Import] No valid leads found after validation')
      return NextResponse.json(
        { error: 'No valid leads found', details: errors.slice(0, 10) },
        { status: 400 }
      )
    }

    // Deduplication
    const emails = transformedLeads.filter(l => l.email).map(l => l.email.toLowerCase())
    const phones = transformedLeads.filter(l => l.phone).map(l => l.phone.replace(/\D/g, ''))

    console.log(`[Import] Checking duplicates for ${emails.length} emails, ${phones.length} phones`)

    const existing = await prisma.lead.findMany({
      where: {
        userId: currentUser.userId,
        OR: [
          ...(emails.length > 0 ? [{ email: { in: emails, mode: 'insensitive' as const } }] : []),
          ...(phones.length > 0 ? [{ phone: { in: phones } }] : []),
        ],
      },
      select: { email: true, phone: true },
    })

    console.log(`[Import] Found ${existing.length} existing matches in DB`)

    const existingEmails = new Set(existing.map(l => l.email?.toLowerCase()))
    const existingPhones = new Set(existing.map(l => l.phone?.replace(/\D/g, '')))

    const newLeads = transformedLeads.filter(lead => {
      const emailDup = lead.email && existingEmails.has(lead.email.toLowerCase())
      const phoneDup = lead.phone && existingPhones.has(lead.phone.replace(/\D/g, ''))
      return !emailDup && !phoneDup
    })

    console.log(`[Import] New unique leads to insert: ${newLeads.length}`)

    const duplicateCount = transformedLeads.length - newLeads.length

    if (newLeads.length === 0) {
      console.log('[Import] All leads were duplicates')
      return NextResponse.json({
        success: true,
        count: 0,
        duplicateCount,
        message: `All ${duplicateCount} leads already exist`,
      })
    }

    // Insert leads
    console.log('[Import] Inserting leads into DB...')
    const created = await prisma.lead.createMany({
      // ... existing data mapping
      data: newLeads.map((lead) => ({
        userId: currentUser.userId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone || '',
        email: lead.email || null,
        company: lead.company || null,
        jobTitle: lead.jobTitle || null,
        linkedinUrl: lead.linkedinUrl || null,
        notes: lead.notes || null,
        status: 'pending',
        region: lead.region || lead.country || null,
        linkedinEnriched: false,
      })),
      skipDuplicates: true,
    })
    console.log(`[Import] DB Insert Result: ${created.count}`)

    return NextResponse.json({
      success: true,
      count: created.count,
      duplicateCount,
      enrichmentStarted,
      message: `Imported ${created.count} leads${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''}`,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Failed to import', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
