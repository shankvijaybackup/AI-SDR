'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, CheckCircle, AlertCircle, FileText, Sparkles, ArrowRight, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LeadField {
    key: string
    label: string
    required: boolean
}

interface PreviewData {
    totalRows: number
    headers: string[]
    previewRows: string[][]
    suggestedMappings: Record<string, string | null>
    leadFields: LeadField[]
}

interface CsvColumnMapperProps {
    onSuccess?: () => void
}

export function CsvColumnMapper({ onSuccess }: CsvColumnMapperProps) {
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [importing, setImporting] = useState(false)
    const [preview, setPreview] = useState<PreviewData | null>(null)
    const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({})
    const [autoEnrich, setAutoEnrich] = useState(true)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        count?: number
        duplicateCount?: number
        enrichmentStarted?: number
        debug?: any
    } | null>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile || !selectedFile.name.endsWith('.csv')) {
            alert('Please select a valid CSV file')
            return
        }

        setFile(selectedFile)
        setResult(null)
        setPreview(null)
        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)

            const response = await fetch('/api/leads/preview', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()
            if (response.ok) {
                setPreview(data)
                setColumnMapping(data.suggestedMappings)
            } else {
                alert(data.error || 'Failed to preview CSV')
                setFile(null)
            }
        } catch (error) {
            alert('Failed to preview CSV')
            setFile(null)
        } finally {
            setLoading(false)
        }
    }

    const handleMappingChange = (csvColumn: string, leadField: string | null) => {
        setColumnMapping(prev => ({
            ...prev,
            [csvColumn]: leadField === '' ? null : leadField,
        }))
    }

    const handleImport = async () => {
        if (!file || !preview) return

        // Validate required fields are mapped
        const mappedFields = Object.values(columnMapping).filter(Boolean)
        const hasFirstName = mappedFields.includes('firstName')
        const hasLastName = mappedFields.includes('lastName')
        const hasContact = mappedFields.includes('phone') || mappedFields.includes('email')

        if (!hasFirstName || !hasLastName) {
            alert('Please map firstName and lastName fields')
            return
        }
        if (!hasContact) {
            alert('Please map at least phone or email')
            return
        }

        setImporting(true)
        setResult(null)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('columnMapping', JSON.stringify(columnMapping))
            formData.append('autoEnrich', autoEnrich.toString())

            const response = await fetch('/api/leads/import', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            setResult({
                success: response.ok,
                message: data.message || data.error,
                count: data.count,
                duplicateCount: data.duplicateCount,
                enrichmentStarted: data.enrichmentStarted,
                debug: data.debug,
            })

            if (response.ok) {
                setFile(null)
                setPreview(null)
                setColumnMapping({})
                if (onSuccess) onSuccess()
            }
        } catch (error) {
            setResult({
                success: false,
                message: 'Network error. Please try again.',
            })
        } finally {
            setImporting(false)
        }
    }

    const handleClear = () => {
        setFile(null)
        setPreview(null)
        setColumnMapping({})
        setResult(null)
    }

    const getMappedCount = () => Object.values(columnMapping).filter(Boolean).length

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Import Leads from CSV</span>
                    {file && (
                        <Button variant="ghost" size="sm" onClick={handleClear}>
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </CardTitle>
                <CardDescription>
                    Upload any CSV file and map columns to lead fields
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!preview ? (
                    // Step 1: File Upload
                    <div>
                        <label className="block">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                disabled={loading}
                            />
                            <div className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                                        <span className="text-sm text-slate-600">Analyzing CSV...</span>
                                    </div>
                                ) : (
                                    <>
                                        <FileText className="w-8 h-8 text-slate-400" />
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-slate-700">Drop CSV or click to upload</p>
                                            <p className="text-xs text-slate-500">Works with any CSV format</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </label>
                    </div>
                ) : (
                    // Step 2: Column Mapping
                    <>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">
                                <strong>{preview.totalRows}</strong> rows found • <strong>{getMappedCount()}</strong> of {preview.headers.length} columns mapped
                            </span>
                            <span className="text-xs text-slate-500">{file?.name}</span>
                        </div>

                        {/* Column Mapping Table */}
                        <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="text-left py-2 px-3 font-medium text-slate-700">CSV Column</th>
                                        <th className="text-center py-2 px-3 font-medium text-slate-700 w-12"></th>
                                        <th className="text-left py-2 px-3 font-medium text-slate-700">Map To</th>
                                        <th className="text-left py-2 px-3 font-medium text-slate-700">Sample Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.headers.map((header, idx) => (
                                        <tr key={header} className="border-t hover:bg-slate-50">
                                            <td className="py-2 px-3">
                                                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{header}</code>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <ArrowRight className="w-4 h-4 text-slate-400 inline" />
                                            </td>
                                            <td className="py-2 px-3">
                                                <select
                                                    value={columnMapping[header] || ''}
                                                    onChange={(e) => handleMappingChange(header, e.target.value)}
                                                    className={`block w-full border rounded px-2 py-1 text-sm ${columnMapping[header] ? 'border-green-300 bg-green-50' : 'border-gray-200'
                                                        }`}
                                                >
                                                    <option value="">— Skip —</option>
                                                    {preview.leadFields.map((field) => (
                                                        <option key={field.key} value={field.key}>
                                                            {field.label} {field.required ? '*' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 px-3 text-xs text-slate-500 truncate max-w-[150px]">
                                                {preview.previewRows[0]?.[idx] || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Auto-Enrich Option */}
                        <label className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 cursor-pointer hover:border-purple-300 transition-colors">
                            <input
                                type="checkbox"
                                checked={autoEnrich}
                                onChange={(e) => setAutoEnrich(e.target.checked)}
                                className="w-4 h-4 rounded border-purple-300 text-purple-600"
                            />
                            <Sparkles className="w-5 h-5 text-purple-500" />
                            <div>
                                <p className="text-sm font-medium text-slate-700">Auto-Enrich with LinkedIn</p>
                                <p className="text-xs text-slate-500">Enrich leads that have LinkedIn URLs</p>
                            </div>
                        </label>

                        {/* Import Button */}
                        <Button
                            onClick={handleImport}
                            disabled={importing || getMappedCount() < 3}
                            className="w-full"
                            size="lg"
                        >
                            {importing ? (
                                <>
                                    <Upload className="w-4 h-4 mr-2 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import {preview.totalRows} Leads
                                </>
                            )}
                        </Button>
                    </>
                )}

                {/* Result Message */}
                {result && (
                    <Alert variant={result.success ? 'default' : 'destructive'}>
                        {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <AlertDescription>
                            <p className="font-medium">{result.message}</p>
                            {result.duplicateCount !== undefined && result.duplicateCount > 0 && (
                                <p className="text-sm mt-1">🔄 {result.duplicateCount} duplicates skipped</p>
                            )}
                            {result.enrichmentStarted !== undefined && result.enrichmentStarted > 0 && (
                                <p className="text-sm mt-1 text-purple-600">
                                    ✨ Auto-enriching {result.enrichmentStarted} leads...
                                </p>
                            )}
                            {/* DEBUG: Show detailed error info if available */}
                            {result.debug && (
                                <div className="mt-4 p-2 bg-slate-100 rounded text-xs font-mono overflow-auto max-h-40">
                                    <p className="font-semibold text-slate-700 mb-1">Debug Info:</p>
                                    <pre>{JSON.stringify(result.debug, null, 2)}</pre>
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    )
}
