import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { parseCSV } from '@/lib/csv-parser'

// Lead field definitions for mapping
const LEAD_FIELDS = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'company', label: 'Company', required: false },
    { key: 'jobTitle', label: 'Job Title', required: false },
    { key: 'linkedinUrl', label: 'LinkedIn URL', required: false },
    { key: 'notes', label: 'Notes', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'region', label: 'Region', required: false },
]

// Auto-suggest field mappings based on CSV column names
function suggestMapping(csvColumn: string): string | null {
    const col = csvColumn.toLowerCase().replace(/[_\s-]/g, '')

    const mappings: Record<string, string> = {
        // First name variations
        'firstname': 'firstName',
        'first': 'firstName',
        'fname': 'firstName',
        'givenname': 'firstName',

        // Last name variations
        'lastname': 'lastName',
        'last': 'lastName',
        'lname': 'lastName',
        'surname': 'lastName',
        'familyname': 'lastName',

        // Phone variations (including Searcher/Apollo export columns)
        'phone': 'phone',
        'phonenumber': 'phone',
        'mobile': 'phone',
        'mobilephone': 'phone',
        'mobilenumber': 'phone',      // For mobile_number column
        'cell': 'phone',
        'cellphone': 'phone',
        'telephone': 'phone',
        'worknumber': 'phone',        // For work_number column
        'workphone': 'phone',
        'businessphone': 'phone',
        'sourcednumber': 'phone',     // For sourced_number column
        'manuallyaddednumber': 'phone', // For manually_added_number column

        // Email variations
        'email': 'email',
        'emailaddress': 'email',
        'workemail': 'email',

        // Company variations
        'company': 'company',
        'companyname': 'company',
        'organization': 'company',
        'organisation': 'company',
        'employer': 'company',

        // Job title variations
        'jobtitle': 'jobTitle',
        'title': 'jobTitle',
        'position': 'jobTitle',
        'role': 'jobTitle',
        'simplifiedtitle': 'jobTitle',

        // LinkedIn variations
        'linkedinurl': 'linkedinUrl',
        'linkedin': 'linkedinUrl',
        'linkedinprofile': 'linkedinUrl',

        // Region/location variations
        'region': 'region',
        'country': 'region',
        'location': 'region',
        'state': 'region',

        // Notes
        'notes': 'notes',
        'comments': 'notes',
        'description': 'notes',

        // Status
        'status': 'status',
        'leadstatus': 'status',
    }

    return mappings[col] || null
}

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

        const csvText = await file.text()
        const rows = parseCSV(csvText)

        if (rows.length === 0) {
            return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
        }

        const headers = rows[0]
        const previewRows = rows.slice(1, 4) // First 3 data rows for preview

        // Generate suggested mappings
        const suggestedMappings: Record<string, string | null> = {}
        const usedFields = new Set<string>()

        headers.forEach(header => {
            const suggestion = suggestMapping(header)
            // Avoid duplicate mappings
            if (suggestion && !usedFields.has(suggestion)) {
                suggestedMappings[header] = suggestion
                usedFields.add(suggestion)
            } else {
                suggestedMappings[header] = null
            }
        })

        return NextResponse.json({
            success: true,
            totalRows: rows.length - 1, // Exclude header
            headers,
            previewRows,
            suggestedMappings,
            leadFields: LEAD_FIELDS,
        })
    } catch (error) {
        console.error('CSV preview error:', error)
        return NextResponse.json(
            { error: 'Failed to preview CSV', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
