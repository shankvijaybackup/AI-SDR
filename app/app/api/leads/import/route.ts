import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { csvToObjects, leadCsvSchema } from '@/lib/csv-parser'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Read file content
    const csvText = await file.text()
    
    // Parse and validate CSV
    const { data: leads, errors } = csvToObjects(csvText, leadCsvSchema)

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation errors in CSV',
          details: errors,
          successCount: leads.length,
        },
        { status: 400 }
      )
    }

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads found in CSV' },
        { status: 400 }
      )
    }

    // Bulk insert leads
    const createdLeads = await prisma.lead.createMany({
      data: leads.map((lead) => ({
        userId: currentUser.userId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email || null,
        company: lead.company || null,
        jobTitle: lead.jobTitle || null,
        linkedinUrl: lead.linkedinUrl || null,
        notes: lead.notes || null,
        status: lead.status || 'pending',
        region: lead.region ? String(lead.region).trim() || null : null,
        linkedinEnriched: false,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      success: true,
      count: createdLeads.count,
      message: `Successfully imported ${createdLeads.count} leads`,
    })
  } catch (error) {
    console.error('Lead import error:', error)
    return NextResponse.json(
      { error: 'Failed to import leads', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
