import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { parseCSV } from '@/lib/csv-parser'
import { enrichLead } from '@/lib/linkedin-enrichment'

interface ColumnMapping {
  [csvColumn: string]: string | null
}

// Structured audit log helper
function auditLog(requestId: string, event: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  console.log(JSON.stringify({
    timestamp,
    requestId,
    event: `[IMPORT] ${event}`,
    ...data
  }))
}

export async function POST(request: NextRequest) {
  const requestId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    auditLog(requestId, 'START', { url: request.url })

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      auditLog(requestId, 'AUTH_FAIL', { error: 'Not authenticated' })
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    auditLog(requestId, 'AUTH_OK', { userId: currentUser.userId })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const autoEnrich = formData.get('autoEnrich') === 'true'
    const columnMappingStr = formData.get('columnMapping') as string

    auditLog(requestId, 'FORM_DATA', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      autoEnrich,
      hasColumnMapping: !!columnMappingStr
    })

    if (!file) {
      auditLog(requestId, 'ERROR', { error: 'No file uploaded' })
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      auditLog(requestId, 'ERROR', { error: 'File must be a CSV', fileName: file.name })
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Parse column mapping
    let columnMapping: ColumnMapping = {}
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr)
        auditLog(requestId, 'COLUMN_MAPPING', { mapping: columnMapping })
      } catch {
        auditLog(requestId, 'ERROR', { error: 'Invalid column mapping JSON' })
        return NextResponse.json({ error: 'Invalid column mapping' }, { status: 400 })
      }
    }

    const csvText = await file.text()
    auditLog(requestId, 'CSV_READ', { textLength: csvText.length, preview: csvText.substring(0, 200) })

    const rows = parseCSV(csvText)
    auditLog(requestId, 'CSV_PARSED', { rowCount: rows.length, headers: rows[0] })

    if (rows.length < 2) {
      auditLog(requestId, 'ERROR', { error: 'CSV empty', rowCount: rows.length })
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    const headers = rows[0]
    const dataRows = rows.slice(1)

    // Transform rows using column mapping
    const transformedLeads: any[] = []
    const errors: Array<{ row: number; errors: string[] }> = []

    dataRows.forEach((row, index) => {
      const rowNumber = index + 2
      const lead: any = {}

      // Apply column mapping
      if (Object.keys(columnMapping).length > 0) {
        headers.forEach((header, colIndex) => {
          const targetField = columnMapping[header]
          if (targetField && row[colIndex]) {
            lead[targetField] = row[colIndex].trim()
          }
        })
      } else {
        // Legacy mode: expect exact column names
        headers.forEach((header, colIndex) => {
          if (row[colIndex]) {
            lead[header] = row[colIndex].trim()
          }
        })
      }

      // Validate required fields
      const rowErrors: string[] = []
      if (!lead.firstName) rowErrors.push('firstName required')
      if (!lead.lastName) rowErrors.push('lastName required')
      if (!lead.phone && !lead.email) rowErrors.push('phone or email required')

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, errors: rowErrors })
      } else {
        transformedLeads.push(lead)
      }
    })

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

    // Auto-enrich
    let enrichmentStarted = 0
    if (autoEnrich && created.count > 0) {
      const toEnrich = await prisma.lead.findMany({
        where: {
          userId: currentUser.userId,
          linkedinUrl: { not: null },
          linkedinEnriched: false,
        },
        orderBy: { createdAt: 'desc' },
        take: created.count,
      })
      enrichmentStarted = toEnrich.length
      console.log(`[Import] Auto-enriching ${enrichmentStarted} leads`)

      Promise.all(
        toEnrich.map(async (lead) => {
          try {
            await enrichLead(lead.id, currentUser.userId)
            console.log(`[Enrich] ✅ ${lead.firstName}`)
          } catch (e) {
            console.error(`[Enrich] ❌ ${lead.firstName}`)
          }
        })
      ).catch(console.error)
    }

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
