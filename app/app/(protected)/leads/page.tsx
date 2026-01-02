'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CsvColumnMapper } from '@/components/csv-column-mapper'
import { AddLeadDialog } from '@/components/add-lead-dialog'
import LeadPersonaDisplay from '@/components/lead-persona-display'
import { QuickCallModal } from '@/components/quick-call-modal'
import { Search, Plus, Phone, Mail, Linkedin, Upload as UploadIcon, Trash2, Sparkles, Eye, RefreshCw, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Lead {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone: string
  company?: string
  jobTitle?: string
  linkedinUrl?: string
  accountId?: string
  status: string
  interestLevel?: string
  region?: string
  linkedinEnriched: boolean
  linkedinData?: any
  calls: any[]
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [enrichingLeads, setEnrichingLeads] = useState<Set<string>>(new Set())
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [callLead, setCallLead] = useState<Lead | null>(null)  // For quick call modal

  useEffect(() => {
    fetchLeads()
  }, [statusFilter])

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/leads?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLeads(data.leads)
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads)
    if (checked) {
      newSelected.add(leadId)
    } else {
      newSelected.delete(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const handleEnrichLead = async (leadId: string) => {
    setEnrichingLeads(prev => new Set(prev).add(leadId))

    try {
      const response = await fetch(`/api/leads/${leadId}/enrich`, {
        method: 'POST',
      })

      if (response.ok) {
        // Fetch fresh leads
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.append('status', statusFilter)
        const leadsResponse = await fetch(`/api/leads?${params}`)
        if (leadsResponse.ok) {
          const data = await leadsResponse.json()
          setLeads(data.leads)
          // Update selectedLead if it's the one we just enriched
          if (selectedLead?.id === leadId) {
            const updatedLead = data.leads.find((l: Lead) => l.id === leadId)
            if (updatedLead) {
              setSelectedLead(updatedLead)
            }
          }
        }
        alert('Lead enriched successfully with LinkedIn data!')
      } else {
        const error = await response.json()
        alert(`Enrichment failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Enrich error:', error)
      alert('Failed to enrich lead')
    } finally {
      setEnrichingLeads(prev => {
        const next = new Set(prev)
        next.delete(leadId)
        return next
      })
    }
  }

  const handleBulkEnrich = async () => {
    if (selectedLeads.size === 0) return

    const leadsToEnrich = Array.from(selectedLeads)
    setEnrichingLeads(new Set(leadsToEnrich))

    let successCount = 0
    let failCount = 0

    for (const leadId of leadsToEnrich) {
      try {
        const response = await fetch(`/api/leads/${leadId}/enrich`, {
          method: 'POST',
        })

        if (response.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch (error) {
        failCount++
      }
    }

    setEnrichingLeads(new Set())
    await fetchLeads()
    alert(`Enrichment complete: ${successCount} succeeded, ${failCount} failed`)
    setSelectedLeads(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedLeads.size} lead${selectedLeads.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/leads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        setSelectedLeads(new Set())
        fetchLeads()
      } else {
        const error = await response.json()
        alert(`Failed to delete leads: ${error.error}`)
      }
    } catch (error) {
      console.error('Bulk delete error:', error)
      alert('Failed to delete leads')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase()
    return (
      lead.firstName.toLowerCase().includes(searchLower) ||
      lead.lastName.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower)
    )
  })

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      not_interested: 'bg-red-100 text-red-800',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-2">Manage your lead pipeline</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Bulk actions - always show for debugging */}
          <Button
            onClick={handleBulkEnrich}
            variant="outline"
            disabled={enrichingLeads.size > 0 || selectedLeads.size === 0}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {enrichingLeads.size > 0 ? 'Enriching...' : `Enrich ${selectedLeads.size}`}
          </Button>
          <Button
            onClick={() => {
              console.log('[DEBUG] Delete clicked, selectedLeads:', selectedLeads.size, Array.from(selectedLeads))
              handleBulkDelete()
            }}
            variant="destructive"
            disabled={isDeleting || selectedLeads.size === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? 'Deleting...' : `Delete ${selectedLeads.size}`}
          </Button>
          <Button onClick={() => setShowUpload(!showUpload)} variant="outline">
            <UploadIcon className="w-4 h-4 mr-2" />
            {showUpload ? 'Hide Upload' : 'Import CSV'}
          </Button>
          <Button onClick={() => setShowAddDialog(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {showUpload && (
        <CsvColumnMapper
          onSuccess={() => {
            fetchLeads()
            setShowUpload(false)
          }}
        />
      )}

      <AddLeadDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchLeads}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Leads</CardTitle>
              <CardDescription>
                {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <UploadIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No leads yet</h3>
              <p className="text-slate-500 mb-4">Click "Import CSV" above to get started</p>
              <Button onClick={() => setShowUpload(true)}>
                <UploadIcon className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleSelectAll(e.target.checked)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Region</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Contact</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Calls</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectLead(lead.id, e.target.checked)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-medium text-slate-900 hover:text-primary hover:underline"
                          >
                            {lead.firstName} {lead.lastName}
                          </Link>
                          {lead.jobTitle && (
                            <p className="text-sm text-slate-500">{lead.jobTitle}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700">
                        {lead.company ? (
                          lead.accountId ? (
                            <Link href={`/accounts/${lead.accountId}`} className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 group">
                              {lead.company}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          ) : (
                            lead.company
                          )
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700">
                        <a href={`tel:${lead.phone}`} className="hover:text-primary hover:underline">
                          {lead.phone}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {lead.region || 'Not set'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-slate-600 hover:text-primary">
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setCallLead(lead)}
                            className="text-green-600 hover:text-green-700 transition-colors"
                            title="AI Call"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          {lead.linkedinUrl && (
                            <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-primary">
                              <Linkedin className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700">
                        {lead.calls.length}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {lead.linkedinUrl && !lead.linkedinEnriched && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEnrichLead(lead.id)}
                              disabled={enrichingLeads.has(lead.id)}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {enrichingLeads.has(lead.id) ? 'Enriching...' : 'Enrich'}
                            </Button>
                          )}
                          {lead.linkedinEnriched && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Enriched
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLead(lead)
                              setShowDetailDialog(true)
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <div className="max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center justify-between">
                  <span>{selectedLead?.firstName} {selectedLead?.lastName}</span>
                  {selectedLead?.linkedinUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedLead && handleEnrichLead(selectedLead.id)}
                      disabled={enrichingLeads.has(selectedLead?.id || '')}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${enrichingLeads.has(selectedLead?.id || '') ? 'animate-spin' : ''}`} />
                      {selectedLead?.linkedinEnriched ? 'Re-Enrich' : 'Enrich'}
                    </Button>
                  )}
                </div>
              </DialogTitle>
              <DialogDescription>
                {selectedLead?.jobTitle && selectedLead?.company
                  ? `${selectedLead.jobTitle} at ${selectedLead.company}`
                  : selectedLead?.company || selectedLead?.jobTitle || 'No info'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {/* Contact Info */}
              <div className="flex items-center space-x-4 mb-6 p-3 bg-slate-50 rounded-lg">
                {selectedLead?.email && (
                  <a href={`mailto:${selectedLead.email}`} className="flex items-center text-sm text-slate-600 hover:text-primary">
                    <Mail className="w-4 h-4 mr-1" /> {selectedLead.email}
                  </a>
                )}
                {selectedLead?.phone && (
                  <a href={`tel:${selectedLead.phone}`} className="flex items-center text-sm text-slate-600 hover:text-primary">
                    <Phone className="w-4 h-4 mr-1" /> {selectedLead.phone}
                  </a>
                )}
                {selectedLead?.linkedinUrl && (
                  <a href={selectedLead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:underline">
                    <Linkedin className="w-4 h-4 mr-1" /> LinkedIn
                  </a>
                )}
              </div>

              {/* Persona Display */}
              {selectedLead?.linkedinEnriched && selectedLead?.linkedinData ? (
                <LeadPersonaDisplay linkedinData={selectedLead.linkedinData} />
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No persona data available</p>
                  {selectedLead?.linkedinUrl ? (
                    <Button
                      className="mt-4"
                      onClick={() => selectedLead && handleEnrichLead(selectedLead.id)}
                      disabled={enrichingLeads.has(selectedLead?.id || '')}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {enrichingLeads.has(selectedLead?.id || '') ? 'Enriching...' : 'Enrich with LinkedIn'}
                    </Button>
                  ) : (
                    <p className="text-sm mt-2">Add a LinkedIn URL to generate persona</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Call Modal */}
      <QuickCallModal
        open={!!callLead}
        onOpenChange={(open) => !open && setCallLead(null)}
        lead={callLead}
        onCallComplete={() => fetchLeads()}
      />
    </div >
  )
}
