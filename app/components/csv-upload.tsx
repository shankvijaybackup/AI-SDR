'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, CheckCircle, AlertCircle, FileText, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CsvUploadProps {
  title: string
  description: string
  endpoint: string
  sampleFormat: string[]
  onSuccess?: () => void
  showAutoEnrich?: boolean  // Only show for leads import
}

export function CsvUpload({ title, description, endpoint, sampleFormat, onSuccess, showAutoEnrich = false }: CsvUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [autoEnrich, setAutoEnrich] = useState(true) // Default to true for better UX
  const [result, setResult] = useState<{
    success: boolean
    message: string
    count?: number
    enrichmentStarted?: number
    errors?: Array<{ row: number; errors: string[] }>
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile)
      setResult(null)
    } else {
      alert('Please select a valid CSV file')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (showAutoEnrich) {
        formData.append('autoEnrich', autoEnrich.toString())
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          count: data.count,
          enrichmentStarted: data.enrichmentStarted,
        })
        setFile(null)
        if (onSuccess) onSuccess()
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload failed',
          errors: data.details,
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sample Format */}
        <div className="bg-slate-50 p-4 rounded-lg border">
          <p className="text-sm font-medium text-slate-700 mb-2">Required CSV Format:</p>
          <code className="text-xs text-slate-600 block font-mono">
            {sampleFormat.join(',')}
          </code>
        </div>

        {/* Auto-Enrich Option (for leads only) */}
        {showAutoEnrich && (
          <label className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 cursor-pointer hover:border-purple-300 transition-colors">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={(e) => setAutoEnrich(e.target.checked)}
              className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <Sparkles className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-slate-700">Auto-Enrich with LinkedIn</p>
              <p className="text-xs text-slate-500">Automatically enrich leads that have LinkedIn URLs</p>
            </div>
          </label>
        )}

        {/* File Input */}
        <div className="flex items-center gap-3">
          <label className="flex-1">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FileText className="w-5 h-5 text-slate-500" />
              <span className="text-sm text-slate-600">
                {file ? file.name : 'Choose CSV file...'}
              </span>
            </div>
          </label>

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6"
          >
            {uploading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>

        {/* Result Messages */}
        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <p className="font-medium">{result.message}</p>
              {result.count !== undefined && (
                <p className="text-sm mt-1">Imported {result.count} records</p>
              )}
              {result.enrichmentStarted !== undefined && result.enrichmentStarted > 0 && (
                <p className="text-sm mt-1 text-purple-600">
                  ✨ Auto-enriching {result.enrichmentStarted} leads in background...
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">Validation Errors:</p>
                  <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.errors.join(', ')}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="italic">...and {result.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
