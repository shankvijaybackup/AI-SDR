import { z } from 'zod'

// Lead CSV validation schema
export const leadCsvSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  jobTitle: z.string().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  status: z.enum(['pending', 'contacted', 'interested', 'not_interested']).optional().or(z.literal('')),
})

// Script CSV validation schema
export const scriptCsvSchema = z.object({
  name: z.string().min(1, 'Script name is required'),
  content: z.string().min(1, 'Script content is required'),
  isDefault: z.string().transform((val) => val.toLowerCase() === 'true'),
})

export type LeadCsvRow = z.infer<typeof leadCsvSchema>
export type ScriptCsvRow = z.infer<typeof scriptCsvSchema>

export function parseCSV(csvText: string): string[][] {
  const lines = csvText.split('\n').filter(line => line.trim())
  const result: string[][] = []
  
  for (const line of lines) {
    const row: string[] = []
    let currentField = ''
    let insideQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes
        }
      } else if (char === ',' && !insideQuotes) {
        // End of field
        row.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }
    
    // Add last field
    row.push(currentField.trim())
    result.push(row)
  }
  
  return result
}

export function csvToObjects<T>(
  csvText: string,
  schema: z.ZodSchema<T>
): { data: T[]; errors: Array<{ row: number; errors: string[] }> } {
  const rows = parseCSV(csvText)
  
  if (rows.length === 0) {
    return { data: [], errors: [{ row: 0, errors: ['CSV file is empty'] }] }
  }
  
  const headers = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1)
  
  const data: T[] = []
  const errors: Array<{ row: number; errors: string[] }> = []
  
  dataRows.forEach((row, index) => {
    const rowNumber = index + 2 // +2 because index 0 is headers, and we want 1-based row numbers
    
    // Create object from row
    const obj: any = {}
    headers.forEach((header, i) => {
      const value = row[i] || ''
      obj[header] = value
    })
    
    // Validate
    const result = schema.safeParse(obj)
    
    if (result.success) {
      data.push(result.data)
    } else {
      errors.push({
        row: rowNumber,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      })
    }
  })
  
  return { data, errors }
}
