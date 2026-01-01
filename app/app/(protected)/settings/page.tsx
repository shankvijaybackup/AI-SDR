'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Linkedin, Shield, AlertCircle, Users, User, CheckCircle, XCircle, Mail, Calendar, UserPlus, Copy, Send, Phone, Plus, Trash2, Globe, Building2, Crown, Loader2, Volume2, Search, ShoppingCart, DollarSign } from 'lucide-react'

interface TeamUser {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string | null
  role: string
  isActive: boolean
  isEmailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  _count: {
    leads: number
    calls: number
  }
}

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName: string | null
  companyId: string | null
  role: string
  linkedinSessionCookie: string | null
  isActive: boolean
  isEmailVerified: boolean
}


// Voicemail interface
interface VoicemailMessage {
  id: string
  name: string
  audioUrl: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

export default function SettingsPage() {
  // Voicemail state
  const [voicemailMessages, setVoicemailMessages] = useState<VoicemailMessage[]>([])
  const [voicemailForm, setVoicemailForm] = useState({ name: '', audioUrl: '', isDefault: false })
  const [savingVoicemail, setSavingVoicemail] = useState(false)

  const [linkedinCookie, setLinkedinCookie] = useState('')
  const [hasLinkedIn, setHasLinkedIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Invite user state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; email: string } | null>(null)

  // Regional phone numbers state
  interface PhoneNumber { id: string; region: string; phoneNumber: string; isDefault: boolean; provider?: string; monthlyCost?: number; twilioSid?: string }
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [phoneForm, setPhoneForm] = useState({ region: '', phoneNumber: '', isDefault: false })
  const [savingPhone, setSavingPhone] = useState(false)

  // Number browsing state
  const [showBrowseDialog, setShowBrowseDialog] = useState(false)
  const [searchCountry, setSearchCountry] = useState('US')
  const [searchAreaCode, setSearchAreaCode] = useState('')
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([])
  const [searchingNumbers, setSearchingNumbers] = useState(false)
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null)

  // Organization state
  interface Organization {
    id: string
    name: string
    slug: string
    plan: string
    billingEmail: string | null
    stats: { users: number; leads: number; calls: number }
    settings: {
      aiCallingEnabled: boolean
      knowledgeBaseEnabled: boolean
      trialEndsAt: string | null
      subscriptionStatus: string | null
      hasOpenaiKey: boolean
      hasTwilioKey: boolean
      hasElevenLabsKey: boolean
      hasDeepgramKey: boolean
      hasGoogleAiKey: boolean
      hubspotConnected: boolean
    } | null
  }
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingOrg, setLoadingOrg] = useState(true)



  useEffect(() => {
    fetchUserData()
    fetchUsers()
    fetchProfile()
    fetchPhoneNumbers()
    fetchOrganization()
    fetchVoicemailMessages()
  }, [])

  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/settings/phone-numbers')
      if (response.ok) {
        const data = await response.json()
        setPhoneNumbers(data.phoneNumbers)
      }
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error)
    }
  }

  const fetchOrganization = async () => {
    try {
      setLoadingOrg(true)
      const response = await fetch('/api/settings/organization')
      if (response.ok) {
        const data = await response.json()
        setOrganization(data.organization)
        setIsAdmin(data.isAdmin)
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error)
    } finally {
      setLoadingOrg(false)
    }
  }



  const handleSavePhoneNumber = async () => {
    if (!phoneForm.region || !phoneForm.phoneNumber) {
      setMessage({ type: 'error', text: 'Please enter region and phone number' })
      return
    }
    setSavingPhone(true)
    try {
      const response = await fetch('/api/settings/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phoneForm),
      })
      if (response.ok) {
        setMessage({ type: 'success', text: 'Phone number saved!' })
        setPhoneForm({ region: '', phoneNumber: '', isDefault: false })
        fetchPhoneNumbers()
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save phone number' })
    } finally {
      setSavingPhone(false)
    }
  }

  const handleDeletePhoneNumber = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/phone-numbers?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        setMessage({ type: 'success', text: 'Phone number removed' })
        fetchPhoneNumbers()
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  const handleSearchNumbers = async () => {
    setSearchingNumbers(true)
    try {
      const params = new URLSearchParams({
        country: searchCountry,
        ...(searchAreaCode && { areaCode: searchAreaCode }),
        limit: '20',
      })
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
      const response = await fetch(`${backendUrl}/api/twilio-numbers/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableNumbers(data.numbers)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to search numbers' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to search numbers' })
    } finally {
      setSearchingNumbers(false)
    }
  }

  const handlePurchaseNumber = async (phoneNumber: string) => {
    if (!confirm(`Purchase ${phoneNumber}? This will cost approximately $1-2/month.`)) {
      return
    }

    setPurchasingNumber(phoneNumber)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
      const response = await fetch(`${backendUrl}/api/twilio-numbers/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, region: searchCountry }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessage({ type: 'success', text: data.message })
        setShowBrowseDialog(false)
        setAvailableNumbers([])
        fetchPhoneNumbers()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to purchase number' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to purchase number' })
    } finally {
      setPurchasingNumber(null)
    }
  }

  const handleReleaseNumber = async (id: string, phoneNumber: string) => {
    if (!confirm(`Release ${phoneNumber}? This will permanently remove it from your account.`)) {
      return
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
      const number = phoneNumbers.find(n => n.id === id)
      if (!number?.twilioSid) {
        setMessage({ type: 'error', text: 'Cannot release: missing Twilio SID' })
        return
      }
      const response = await fetch(`${backendUrl}/api/twilio-numbers/release?twilioSid=${number.twilioSid}`, { method: 'DELETE' })
      if (response.ok) {
        const data = await response.json()
        setMessage({ type: 'success', text: data.message })
        fetchPhoneNumbers()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to release number' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to release number' })
    }
  }

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/linkedin')
      if (response.ok) {
        const data = await response.json()
        setHasLinkedIn(data.hasLinkedIn)
      }
    } catch (error) {
      console.error('Failed to fetch LinkedIn session:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteId) return
    try {
      const response = await fetch(`/api/settings/users/${deleteId}`, { method: 'DELETE' })
      if (response.ok) {
        setMessage({ type: 'success', text: 'User deleted successfully' })
        setUsers(users.filter(u => u.id !== deleteId))
      } else {
        setMessage({ type: 'error', text: 'Failed to delete user' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to delete user' })
    } finally {
      setDeleteId(null)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/users/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        setHasLinkedIn(!!data.user.linkedinSessionCookie)
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive }),
      })
      if (response.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Failed to toggle user status:', error)
    }
  }

  const handleResendVerification = async (userId: string, email: string) => {
    setMessage(null)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.emailSent
            ? `Verification email sent to ${email}`
            : `Verification link generated for ${email}. Check console for URL.`
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to resend verification' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to resend verification' })
    }
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setProfileSaving(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          company: profile.companyName,
          linkedinSessionCookie: linkedinCookie || profile.linkedinSessionCookie,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        setHasLinkedIn(!!data.user.linkedinSessionCookie)
        setLinkedinCookie('')
        setMessage({ type: 'success', text: 'Profile saved successfully!' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSaveLinkedIn = async () => {
    if (!linkedinCookie.trim()) {
      setMessage({ type: 'error', text: 'Please enter a LinkedIn session cookie' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCookie: linkedinCookie }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'LinkedIn session saved successfully!' })
        setHasLinkedIn(true)
        setLinkedinCookie('')
      } else {
        setMessage({ type: 'error', text: 'Failed to save LinkedIn session' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveLinkedIn = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/linkedin', {
        method: 'DELETE',
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'LinkedIn session removed' })
        setHasLinkedIn(false)
      } else {
        setMessage({ type: 'error', text: 'Failed to remove LinkedIn session' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const handleInviteUser = async () => {
    if (!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setInviting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      const data = await response.json()

      if (response.ok) {
        setInviteResult({ url: data.verificationUrl, email: inviteForm.email })
        setMessage({ type: 'success', text: `Invitation sent to ${inviteForm.email}` })
        setInviteForm({ email: '', firstName: '', lastName: '' })
        fetchUsers() // Refresh users list
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send invitation' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setInviting(false)
    }
  }

  const fetchVoicemailMessages = async () => {
    try {
      const response = await fetch('/api/voicemail-messages')
      if (response.ok) {
        const data = await response.json()
        setVoicemailMessages(data.messages)
      }
    } catch (error) {
      console.error('Failed to fetch voicemail messages:', error)
    }
  }

  const handleSaveVoicemail = async () => {
    if (!voicemailForm.name || !voicemailForm.audioUrl) {
      setMessage({ type: 'error', text: 'Name and Audio URL are required' })
      return
    }
    setSavingVoicemail(true)
    try {
      const response = await fetch('/api/voicemail-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voicemailForm),
      })
      if (response.ok) {
        setMessage({ type: 'success', text: 'Voicemail message saved!' })
        setVoicemailForm({ name: '', audioUrl: '', isDefault: false })
        fetchVoicemailMessages()
      } else {
        setMessage({ type: 'error', text: 'Failed to save message' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSavingVoicemail(false)
    }
  }

  const handleDeleteVoicemail = async (id: string) => {
    try {
      await fetch(`/api/voicemail-messages?id=${id}`, { method: 'DELETE' })
      fetchVoicemailMessages()
      setMessage({ type: 'success', text: 'Message deleted' })
    } catch (error) {
      console.error(error)
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  const handleToggleVoicemailDefault = async (id: string) => {
    try {
      await fetch('/api/voicemail-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true })
      })
      fetchVoicemailMessages()
    } catch (error) {
      console.error(error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: 'Link copied to clipboard!' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your account, team, and integrations</p>
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
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <CardTitle>Voicemail Messages</CardTitle>
          </div>
          <CardDescription>
            Manage pre-recorded voicemail messages. The default message will be left when an answering machine is detected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Message */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
            <div className="space-y-2">
              <Label>Message Name</Label>
              <Input
                placeholder="Main Sales Voicemail"
                value={voicemailForm.name}
                onChange={(e) => setVoicemailForm({ ...voicemailForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Audio URL (Link to MP3/WAV)</Label>
              <Input
                placeholder="https://example.com/voicemail.mp3"
                value={voicemailForm.audioUrl}
                onChange={(e) => setVoicemailForm({ ...voicemailForm, audioUrl: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2 pb-2">
              <input
                type="checkbox"
                id="vm-default"
                checked={voicemailForm.isDefault}
                onChange={(e) => setVoicemailForm({ ...voicemailForm, isDefault: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="vm-default" className="cursor-pointer">Set as Default</Label>
            </div>
            <Button onClick={handleSaveVoicemail} disabled={savingVoicemail}>
              {savingVoicemail ? 'Saving...' : 'Add Message'}
            </Button>
          </div>

          {/* List Messages */}
          <div className="space-y-2">
            {voicemailMessages.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No voicemail messages added yet.</p>
            ) : (
              voicemailMessages.map((vm) => (
                <div key={vm.id} className="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium">{vm.name}</p>
                      {vm.isDefault && <Badge variant="secondary" className="bg-green-100 text-green-700">Default</Badge>}
                    </div>
                    <a href={vm.audioUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate max-w-[200px] block">
                      {vm.audioUrl}
                    </a>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!vm.isDefault && (
                      <Button variant="ghost" size="sm" onClick={() => handleToggleVoicemailDefault(vm.id)}>
                        Set Default
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteVoicemail(vm.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-slate-900 dark:text-white">Organization</CardTitle>
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Admin</Badge>
              </div>
            </div>
            <CardDescription>
              Manage your organization settings and billing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOrg ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : organization ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 dark:text-slate-400">Company Name</Label>
                    <p className="font-medium text-slate-900 dark:text-white">{organization.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 dark:text-slate-400">Plan</Label>
                    <Badge className="capitalize" variant={organization.plan === 'trial' ? 'secondary' : 'default'}>
                      {organization.plan}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{organization.stats.users}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Team Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{organization.stats.leads}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Leads</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{organization.stats.calls}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Calls Made</p>
                  </div>
                </div>
                {organization.settings?.trialEndsAt && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Trial ends: {new Date(organization.settings.trialEndsAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">No organization found</p>
            )}
          </CardContent>
        </Card>
      )}


      {/* Integrations Card */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <CardTitle>Integrations</CardTitle>
            </div>
            <CardDescription>Connect external tools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* HubSpot */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#ff7a59] rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">HS</span>
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">HubSpot CRM</h4>
                  <p className="text-sm text-slate-500">Sync companies and contacts</p>
                </div>
              </div>
              <div>
                {organization?.settings?.hubspotConnected ? (
                  <Button variant="outline" className="text-green-600 border-green-200 bg-green-50" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Connected
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (organization?.id) {
                        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
                        window.location.href = `${backendUrl}/api/integrations/hubspot/auth?companyId=${organization.id}`;
                      }
                    }}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <CardTitle>My Profile</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>Edit Profile</Button>
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                  <DialogDescription>
                    Update your profile information and LinkedIn integration
                  </DialogDescription>
                </DialogHeader>
                {profile && (
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={profile.firstName}
                          onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={profile.lastName}
                          onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={profile.companyName || ''}
                        onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={profile.email} disabled className="bg-slate-50" />
                    </div>

                    {/* LinkedIn Integration in Profile */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Linkedin className="w-4 h-4 text-blue-600" />
                        <Label className="text-sm font-medium">LinkedIn Integration</Label>
                      </div>
                      {hasLinkedIn ? (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700">Connected</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={handleRemoveLinkedIn}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
                            <p className="font-medium mb-1">How to get li_at cookie:</p>
                            <p>LinkedIn → DevTools (F12) → Application → Cookies → Copy "li_at"</p>
                          </div>
                          <Input
                            type="password"
                            placeholder="Paste li_at cookie here"
                            value={linkedinCookie}
                            onChange={(e) => setLinkedinCookie(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    <Button onClick={handleSaveProfile} disabled={profileSaving} className="w-full">
                      {profileSaving ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {profile ? (
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {profile.firstName[0]}{profile.lastName[0]}
                </span>
              </div>
              <div className="flex-1">
                <button
                  onClick={() => setProfileOpen(true)}
                  className="text-left hover:underline text-slate-900 dark:text-white"
                >
                  <h3 className="font-medium">{profile.firstName} {profile.lastName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                {hasLinkedIn ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <Linkedin className="w-3 h-3 mr-1" />
                    LinkedIn Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500">
                    <Linkedin className="w-3 h-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
                <Badge variant="outline">{profile.role}</Badge>
              </div>
            </div>
          ) : (
            <div className="animate-pulse flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-slate-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/3"></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <CardTitle>Team Members</CardTitle>
          </div>
          <CardDescription>
            View and manage team members. Activate or deactivate user accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4 p-3 border rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No team members found</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center space-x-4 p-3 border rounded-lg dark:border-slate-700 ${!user.isActive ? 'bg-slate-50 dark:bg-slate-800/50 opacity-60' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {user.firstName[0]}{user.lastName[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-slate-900 dark:text-white truncate">
                        {user.firstName} {user.lastName}
                      </h4>
                      {user.isEmailVerified ? (
                        <span title="Email verified"><CheckCircle className="w-4 h-4 text-green-500" /></span>
                      ) : (
                        <span title="Email not verified"><Mail className="w-4 h-4 text-amber-500" /></span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
                      <span>{user._count.leads} leads</span>
                      <span>{user._count.calls} calls</span>
                      {user.lastLoginAt && (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {!user.isEmailVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendVerification(user.id, user.email)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Mail className="w-4 h-4 mr-1" /> Resend Invite
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleUserActive(user.id, !user.isActive)}
                      className={user.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                    >
                      {user.isActive ? (
                        <><XCircle className="w-4 h-4 mr-1" /> Deactivate</>
                      ) : (
                        <><CheckCircle className="w-4 h-4 mr-1" /> Activate</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteId(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the user from the organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite User */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <CardTitle>Invite New User</CardTitle>
          </div>
          <CardDescription>
            Send an invitation to add a new team member. They will receive a verification link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invite-firstName">First Name</Label>
              <Input
                id="invite-firstName"
                placeholder="John"
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-lastName">Last Name</Label>
              <Input
                id="invite-lastName"
                placeholder="Doe"
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="john@company.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
          </div>
          <Button onClick={handleInviteUser} disabled={inviting} className="w-full">
            {inviting ? (
              <>Sending Invitation...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send Invitation</>
            )}
          </Button>

          {inviteResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <p className="text-sm text-green-800">
                <strong>Invitation created for {inviteResult.email}</strong>
              </p>
              <p className="text-xs text-green-700">
                Share this verification link with the user (or they'll receive it via email):
              </p>
              <div className="flex items-center space-x-2">
                <Input
                  value={inviteResult.url}
                  readOnly
                  className="text-xs bg-white"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(inviteResult.url)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-green-600">
                Link expires in 7 days. User will be activated after verification.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regional Phone Numbers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <CardTitle>Regional Phone Numbers</CardTitle>
            </div>
            <Button onClick={() => setShowBrowseDialog(true)} variant="outline" size="sm">
              <Search className="w-4 h-4 mr-2" />
              Browse & Buy Numbers
            </Button>
          </div>
          <CardDescription>
            Configure Twilio phone numbers for different regions. Calls will use the matching regional number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing numbers */}
          {phoneNumbers.length > 0 && (
            <div className="space-y-2">
              {phoneNumbers.map((phone) => (
                <div key={phone.id} className="flex items-center justify-between p-3 border dark:border-slate-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-slate-900 dark:text-white">{phone.region}</p>
                        {phone.isDefault && <Badge variant="secondary">Default</Badge>}
                        {phone.provider && <Badge variant="outline" className="text-xs">{phone.provider}</Badge>}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{phone.phoneNumber}</p>
                      {phone.monthlyCost && (
                        <p className="text-xs text-slate-400">
                          <DollarSign className="w-3 h-3 inline" />
                          ${phone.monthlyCost.toFixed(2)}/month
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {phone.provider === 'twilio' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-orange-600 hover:text-orange-700"
                        onClick={() => handleReleaseNumber(phone.id, phone.phoneNumber)}
                        title="Release from Twilio"
                      >
                        Release
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeletePhoneNumber(phone.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new number manually */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Or add existing number manually:</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="phone-region">Region</Label>
                <Input
                  id="phone-region"
                  placeholder="ANZ, US, UK, India..."
                  value={phoneForm.region}
                  onChange={(e) => setPhoneForm({ ...phoneForm, region: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone-number">Phone Number</Label>
                <Input
                  id="phone-number"
                  placeholder="+14155551234"
                  value={phoneForm.phoneNumber}
                  onChange={(e) => setPhoneForm({ ...phoneForm, phoneNumber: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSavePhoneNumber} disabled={savingPhone}>
                  <Plus className="w-4 h-4 mr-1" />
                  {savingPhone ? 'Saving...' : 'Add'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Phone must be E.164 format (+country code + number).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Browse Numbers Dialog */}
      <Dialog open={showBrowseDialog} onOpenChange={setShowBrowseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Browse Available Phone Numbers</DialogTitle>
            <DialogDescription>
              Search and purchase Twilio phone numbers for your campaigns
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search Filters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Country</Label>
                <select
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="CA">Canada</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Area Code (Optional)</Label>
                <Input
                  placeholder="415"
                  value={searchAreaCode}
                  onChange={(e) => setSearchAreaCode(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearchNumbers} disabled={searchingNumbers} className="w-full">
                  {searchingNumbers ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>
            </div>

            {/* Results */}
            {availableNumbers.length > 0 && (
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                <div className="divide-y">
                  {availableNumbers.map((number, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="font-medium">{number.phoneNumber}</p>
                        <p className="text-sm text-slate-500">
                          {number.locality}, {number.region}
                        </p>
                        <p className="text-xs text-slate-400">
                          ~${number.estimatedCost.toFixed(2)}/month
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handlePurchaseNumber(number.phoneNumber)}
                        disabled={purchasingNumber === number.phoneNumber}
                      >
                        {purchasingNumber === number.phoneNumber ? (
                          <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Purchasing...</>
                        ) : (
                          <><ShoppingCart className="w-4 h-4 mr-1" /> Purchase</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableNumbers.length === 0 && !searchingNumbers && (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Search for available numbers to get started</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}
