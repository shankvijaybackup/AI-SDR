'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Building2, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface Account {
    id: string
    name: string
    domain: string
    industry: string | null
    employeeCount: number | null
    location: string | null
    enriched: boolean
    hubspotId: string | null
    createdAt: string
    _count: {
        leads: number
    }
}

interface Meta {
    total: number
    page: number
    limit: number
    pages: number
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [meta, setMeta] = useState<Meta | null>(null)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [syncing, setSyncing] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // HubSpot List Import State
    const [importOpen, setImportOpen] = useState(false)
    const [hubspotLists, setHubspotLists] = useState<{ id: string, name: string }[]>([])
    const [selectedListId, setSelectedListId] = useState<string>('')
    const [loadingLists, setLoadingLists] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    const [companyId, setCompanyId] = useState<string | null>(null)

    useEffect(() => {
        fetchProfile()
    }, [])

    useEffect(() => {
        if (companyId) {
            fetchAccounts()
        }
    }, [companyId, page, search])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/auth/me')
            if (res.ok) {
                const data = await res.json()
                if (data.user?.companyId) {
                    setCompanyId(data.user.companyId)
                }
            }
        } catch {
            // Silent fail
        }
    }

    const fetchAccounts = async () => {
        if (!companyId) return
        setLoading(true)
        setMessage(null)
        try {
            const params = new URLSearchParams({
                companyId,
                page: page.toString(),
                limit: '20',
                search
            })
            const res = await fetch(`/api/accounts?${params}`)
            if (res.ok) {
                const data = await res.json()
                setAccounts(data.data)
                setMeta(data.meta)
            }
        } catch (error) {
            console.error(error)
            setMessage({ type: 'error', text: 'Failed to load accounts' })
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        if (!companyId) return
        setSyncing(true)
        setMessage(null)
        try {
            const res = await fetch('/api/accounts/sync/hubspot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Sync Started: HubSpot sync is running in background.' })
            } else {
                setMessage({ type: 'error', text: 'Failed to start sync' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to start sync' })
        } finally {
            setTimeout(() => setSyncing(false), 2000)
        }
    }

    const handleOpenImport = async () => {
        if (!companyId) return
        setImportOpen(true)
        setLoadingLists(true)
        try {
            // Fetch lists
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
            const res = await fetch(`${backendUrl}/api/integrations/hubspot/lists?companyId=${companyId}`)
            if (res.ok) {
                const data = await res.json()
                setHubspotLists(data.lists)
            } else {
                if (res.status === 401) {
                    setMessage({ type: 'error', text: 'HubSpot not connected. Please go to Settings.' })
                    setImportOpen(false)
                }
            }
        } catch (e) {
            console.error(e)
            setMessage({ type: 'error', text: 'Failed to load HubSpot lists' })
        } finally {
            setLoadingLists(false)
        }
    }

    const handleImportList = async () => {
        if (!companyId || !selectedListId) return
        setIsImporting(true)
        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
            const res = await fetch(`${backendUrl}/api/integrations/hubspot/import-list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, listId: selectedListId })
            })
            if (res.ok) {
                const data = await res.json()
                setMessage({ type: 'success', text: `Imported ${data.imported} contacts from list.` })
                setImportOpen(false)
                fetchAccounts() // Refresh
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.error || 'Import failed' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Import failed' })
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Accounts</h1>
                    <p className="text-slate-500 dark:text-slate-400">Target companies and enrichment status</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleOpenImport}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Import List
                    </Button>
                    <Button variant="outline" onClick={handleSync} disabled={syncing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        Sync All
                    </Button>
                    <Link href="/settings">
                        <Button variant="outline">Settings</Button>
                    </Link>
                </div>
            </div>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import from HubSpot List</DialogTitle>
                        <DialogDescription>Select a contact list to import specifically.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select List</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                                value={selectedListId}
                                onChange={(e) => setSelectedListId(e.target.value)}
                            >
                                <option value="" disabled>Choose a list...</option>
                                {loadingLists ? (
                                    <option disabled>Loading lists...</option>
                                ) : hubspotLists.length === 0 ? (
                                    <option disabled>No lists found</option>
                                ) : (
                                    hubspotLists.map(list => (
                                        <option key={list.id} value={list.id}>{list.name}</option>
                                    ))
                                )}
                            </select>
                        </div>
                        <Button onClick={handleImportList} disabled={!selectedListId || isImporting} className="w-full">
                            {isImporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...
                                </>
                            ) : 'Start Import'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search accounts..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-md ${message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                    {message.text}
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <div className="w-full text-sm">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-4 p-4 font-medium text-slate-500 border-b">
                            <div className="col-span-4">Company</div>
                            <div className="col-span-2 hidden md:block">Industry</div>
                            <div className="col-span-2 hidden md:block">Employees</div>
                            <div className="col-span-1 hidden md:block">Leads</div>
                            <div className="col-span-2 hidden md:block">Status</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>

                        {/* Body */}
                        {loading ? (
                            <div className="p-8 text-center">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                No accounts found. Sync from HubSpot or check search.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {accounts.map(account => (
                                    <div key={account.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <Building2 className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="font-medium truncate">{account.name}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                                                    {account.domain}
                                                    {account.hubspotId && <span className="text-[10px] bg-[#ff7a59] text-white px-1 rounded ml-1">HS</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-span-6 md:col-span-2 text-slate-500 mt-2 md:mt-0 px-2 md:px-0 truncate">
                                            <span className="md:hidden font-semibold mr-1">Industry:</span>
                                            {account.industry || '-'}
                                        </div>
                                        <div className="col-span-6 md:col-span-2 text-slate-500 mt-2 md:mt-0 px-2 md:px-0">
                                            <span className="md:hidden font-semibold mr-1">Emp:</span>
                                            {account.employeeCount?.toLocaleString() || '-'}
                                        </div>
                                        <div className="col-span-6 md:col-span-1 mt-2 md:mt-0 px-2 md:px-0">
                                            <Badge variant="secondary" className="rounded-full">
                                                {account._count.leads}
                                            </Badge>
                                        </div>
                                        <div className="col-span-6 md:col-span-2 mt-2 md:mt-0 px-2 md:px-0">
                                            {account.enriched ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    Enriched
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-500">Pending</Badge>
                                            )}
                                        </div>
                                        <div className="col-span-12 md:col-span-1 text-right mt-2 md:mt-0">
                                            <Link href={`/accounts/${account.id}`}>
                                                <Button variant="ghost" size="sm">View</Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            {meta && meta.pages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-500">
                        Page {meta.page} of {meta.pages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                        disabled={page === meta.pages}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
