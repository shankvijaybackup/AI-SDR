'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Building2, Globe, Users, MapPin, DollarSign, Sparkles, CheckCircle2 } from 'lucide-react'

interface ResearchNote {
    id: string
    title: string
    content: string
    url: string | null
    tags: string[]
    relevanceScore: number
    source: string
}

interface Lead {
    id: string
    firstName: string
    lastName: string
    jobTitle: string | null
    email: string
    status: string
}

interface Account {
    id: string
    name: string
    domain: string
    industry: string | null
    employeeCount: number | null
    annualRevenue: string | null
    location: string | null
    enriched: boolean
    enrichmentData: any
    leads: Lead[]
    researchNotes: ResearchNote[]
}

export default function AccountDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const [account, setAccount] = useState<Account | null>(null)
    const [loading, setLoading] = useState(true)
    const [enriching, setEnriching] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        if (id) {
            fetchAccount()
        }
    }, [id])

    const fetchAccount = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/accounts/${id}`)
            if (res.ok) {
                const data = await res.json()
                setAccount(data)
            } else {
                setMessage({ type: 'error', text: 'Account not found' })
                setTimeout(() => router.push('/accounts'), 2000)
            }
        } catch (error) {
            console.error(error)
            setMessage({ type: 'error', text: 'Failed to fetch account' })
        } finally {
            setLoading(false)
        }
    }

    const handleEnrich = async () => {
        setEnriching(true)
        setMessage(null)
        try {
            const res = await fetch(`/api/accounts/${id}/enrich`, { method: 'POST' })
            if (res.ok) {
                const updated = await res.json()
                // Merge the updated data (which includes new research notes)
                // We need to re-fetch or trust the return. Assuming return is partial account.
                // But account-research.ts returns notes? No, the route returns json(updatedAccount).
                // Let's force a refetch or merge correctly.
                setAccount(prev => prev ? { ...prev, ...updated } : updated)
                // Actually the API enrich returns just 'success' or the record?
                // Let's re-fetch to be safe and get the relations.
                fetchAccount()
                setMessage({ type: 'success', text: 'Account enriched successfully.' })
            } else {
                setMessage({ type: 'error', text: 'Enrichment failed' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Enrichment failed' })
        } finally {
            setEnriching(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (!account) return null

    return (
        <div className="space-y-6">
            <Button variant="ghost" className="pl-0 gap-2" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4" /> Back to Accounts
            </Button>

            {message && (
                <div className={`p-4 rounded-md ${message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                        <Building2 className="w-8 h-8 text-slate-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{account.name}</h1>
                        <div className="flex items-center gap-4 mt-1 text-slate-500 text-sm">
                            {account.domain && (
                                <a href={`https://${account.domain}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                                    <Globe className="w-3 h-3" /> {account.domain}
                                </a>
                            )}
                            {account.location && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {account.location}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="flex gap-2">
                        {account.enriched && (
                            <Badge variant="outline" className="h-10 px-4 text-green-600 border-green-200 bg-green-50 gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Enriched
                            </Badge>
                        )}
                        <Button onClick={handleEnrich} disabled={enriching} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90">
                            <Sparkles className={`w-4 h-4 mr-2 ${enriching ? 'animate-spin' : ''}`} />
                            {enriching ? 'Deep Researching...' : account.enriched ? 'Re-Enrich' : 'Enrich Account'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Users className="w-5 h-5 text-blue-500 mb-2" />
                                <p className="text-xs text-slate-500 uppercase font-semibold">Employees</p>
                                <p className="text-lg font-bold">{account.employeeCount?.toLocaleString() || 'N/A'}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <DollarSign className="w-5 h-5 text-green-500 mb-2" />
                                <p className="text-xs text-slate-500 uppercase font-semibold">Revenue</p>
                                <p className="text-lg font-bold">{account.annualRevenue || 'N/A'}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Building2 className="w-5 h-5 text-purple-500 mb-2" />
                                <p className="text-xs text-slate-500 uppercase font-semibold">Industry</p>
                                <p className="text-lg font-bold truncate w-full px-2" title={account.industry || ''}>{account.industry || 'N/A'}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* NEW: Deep Research Notes Section */}
                    {account.researchNotes && account.researchNotes.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-500" />
                                Deep Research Insights
                            </h3>
                            <div className="grid gap-4">
                                {account.researchNotes.map((note) => (
                                    <Card key={note.id} className="overflow-hidden border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start gap-4 mb-2">
                                                <h4 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                                    {note.url ? (
                                                        <a href={note.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline flex items-center gap-1">
                                                            {note.title}
                                                            <Globe className="w-3 h-3 text-slate-400" />
                                                        </a>
                                                    ) : (
                                                        note.title
                                                    )}
                                                </h4>
                                                <Badge className={note.relevanceScore >= 8 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}>
                                                    Score: {note.relevanceScore}/10
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                                                {note.content}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {note.tags && note.tags.map((tag, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs px-2 py-0 h-5">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                                <span className="text-xs text-slate-400 ml-auto self-center">
                                                    Source: {note.source}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* Contacts List */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Key Contacts</CardTitle>
                            <CardDescription>{account.leads.length} leads found in this account</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {account.leads.length === 0 ? (
                                <p className="text-slate-500 text-sm py-4">No contacts found yet.</p>
                            ) : (
                                <div className="space-y-4">
                                    {account.leads.map(lead => (
                                        <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold">
                                                    {lead.firstName[0]}{lead.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{lead.firstName} {lead.lastName}</p>
                                                    <p className="text-xs text-slate-500">{lead.jobTitle || 'No Title'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge variant="secondary" className="text-xs capitalize">{lead.status}</Badge>
                                                <Button size="sm" variant="ghost" className="h-8" onClick={() => router.push(`/leads?search=${lead.email}`)}>
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar / Enrichment Data */}
                <div className="space-y-6">
                    <Card className="h-full border-l-4 border-l-purple-500">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                Intelligence
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="prose prose-sm dark:prose-invert">
                            {account.enriched ? (
                                <div className="space-y-4">
                                    {account.enrichmentData?.description && (
                                        <div>
                                            <h4 className="text-xs uppercase text-slate-500 font-bold mb-1">Description</h4>
                                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                                {account.enrichmentData.description}
                                            </p>
                                        </div>
                                    )}

                                    {account.enrichmentData?.specialties && (
                                        <div>
                                            <h4 className="text-xs uppercase text-slate-500 font-bold mb-1">Specialties</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {Array.isArray(account.enrichmentData.specialties) && account.enrichmentData.specialties.map((s: string) => (
                                                    <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!account.enrichmentData?.description && !account.enrichmentData?.specialties && (
                                        <p className="text-slate-500 italic">No detailed intelligence data available despite enrichment.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-slate-500 mb-4 text-sm">Unlock AI-driven insights about this account.</p>
                                    <Button onClick={handleEnrich} disabled={enriching} size="sm" variant="outline">
                                        {enriching ? 'Analyzing...' : 'Analyze Account'}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
