'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserPlus, Mail, Clock, CheckCircle2, Copy, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

interface PendingInvite {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
  verificationToken?: string
  firstName?: string
  lastName?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activationLink, setActivationLink] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [showLinkForInvite, setShowLinkForInvite] = useState<string | null>(null)

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'agent',
  })

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users || [])
        setPendingInvites(data.pendingInvites || [])
      } else {
        setError(data.error || 'Failed to load users')
      }
    } catch (err) {
      setError('An error occurred while loading users')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!inviteForm.email || !inviteForm.role) {
      setError('Email and role are required')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create user')
        setSubmitting(false)
        return
      }

      // Extract activation link from response
      const verificationUrl = data.verificationUrl || ''
      setActivationLink(verificationUrl)
      setSuccess(`User created: ${inviteForm.email}`)
      setInviteForm({ email: '', role: 'agent' })
      setInviteDialogOpen(false)
      setSubmitting(false)

      // Refresh users list
      fetchUsers()
    } catch (err) {
      setError('An error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-gray-600 mt-1">Invite and manage your team members</p>
        </div>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation email to add a new team member
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="account_owner">Account Owner</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  {inviteForm.role === 'agent'
                    ? 'Can import leads, enrich, view/modify scripts, and make calls'
                    : 'Full access including user management and settings'}
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {success && activationLink && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-800">{success}</CardTitle>
            </div>
            <CardDescription className="text-green-700">
              Share this activation link with the user to complete their setup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
              <LinkIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <code className="text-sm flex-1 break-all">{activationLink}</code>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(activationLink)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button
                onClick={() => window.open(activationLink, '_blank')}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
            </div>
            <p className="text-xs text-gray-600">
              💡 Tip: Send this link via Slack, WhatsApp, or any messaging app
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Users */}
          <Card>
            <CardHeader>
              <CardTitle>Active Users ({users.length})</CardTitle>
              <CardDescription>Team members with active accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No active users found</p>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                          </div>
                        </div>
                        {user.lastLoginAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Last login: {format(new Date(user.lastLoginAt), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.role === 'account_owner' ? 'default' : 'secondary'}>
                          {user.role === 'account_owner' ? 'Account Owner' : 'Agent'}
                        </Badge>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations ({pendingInvites.length})</CardTitle>
                <CardDescription>Users who haven't activated their accounts yet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingInvites.map((invite) => {
                    const inviteLink = invite.verificationToken
                      ? `${window.location.origin}/auth/verify?token=${invite.verificationToken}`
                      : null
                    const isShowingLink = showLinkForInvite === invite.id

                    return (
                      <div key={invite.id} className="border rounded-lg bg-yellow-50 overflow-hidden">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-yellow-600" />
                              <p className="font-medium">
                                {invite.firstName && invite.lastName
                                  ? `${invite.firstName} ${invite.lastName} (${invite.email})`
                                  : invite.email}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Invited {format(new Date(invite.createdAt), 'MMM dd, yyyy')} • Expires{' '}
                              {format(new Date(invite.expiresAt), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-yellow-600 text-yellow-700">
                              {invite.role === 'account_owner' ? 'Account Owner' : 'Agent'}
                            </Badge>
                            {inviteLink && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setShowLinkForInvite(isShowingLink ? null : invite.id)
                                }
                              >
                                <LinkIcon className="w-4 h-4 mr-2" />
                                {isShowingLink ? 'Hide Link' : 'View Link'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isShowingLink && inviteLink && (
                          <div className="px-4 pb-4 space-y-2">
                            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                              <LinkIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              <code className="text-xs flex-1 break-all">{inviteLink}</code>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => copyToClipboard(inviteLink)}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                {copySuccess ? 'Copied!' : 'Copy Link'}
                              </Button>
                              <Button
                                onClick={() => window.open(inviteLink, '_blank')}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open Link
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
