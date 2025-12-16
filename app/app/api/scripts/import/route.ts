import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { csvToObjects, scriptCsvSchema } from '@/lib/csv-parser'

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
    const { data: scripts, errors } = csvToObjects(csvText, scriptCsvSchema)

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation errors in CSV',
          details: errors,
          successCount: scripts.length,
        },
        { status: 400 }
      )
    }

    if (scripts.length === 0) {
      return NextResponse.json(
        { error: 'No valid scripts found in CSV' },
        { status: 400 }
      )
    }

    // If any script is marked as default, unset existing defaults
    const hasDefault = scripts.some(s => s.isDefault)
    if (hasDefault) {
      await prisma.script.updateMany({
        where: { userId: currentUser.userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    // Bulk insert scripts
    const createdScripts = await prisma.script.createMany({
      data: scripts.map((script) => ({
        userId: currentUser.userId,
        name: script.name,
        content: script.content,
        isDefault: script.isDefault,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      success: true,
      count: createdScripts.count,
      message: `Successfully imported ${createdScripts.count} scripts`,
    })
  } catch (error) {
    console.error('Script import error:', error)
    return NextResponse.json(
      { error: 'Failed to import scripts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
