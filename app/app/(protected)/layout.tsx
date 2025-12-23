'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Phone, Users, FileText, Calendar, Settings, LogOut, BarChart3, BookOpen, PhoneCall, User, PanelLeftClose, PanelLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName?: string
  companyId?: string
  role: string
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    fetchUser()
    // Load sidebar state from localStorage
    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true')
    }
  }, [])

  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const navigation = [
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Scripts', href: '/scripts', icon: FileText },
    { name: 'Calling', href: '/bulk-calling', icon: PhoneCall },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Knowledge', href: '/knowledge', icon: BookOpen },
    { name: 'Follow-ups', href: '/follow-ups', icon: Calendar },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Premium Glassmorphism Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-out ${isCollapsed ? 'w-24' : 'w-72'}`}>
          <div className="h-full m-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-slate-900/5 dark:shadow-slate-900/50">
            <div className="flex flex-col h-full">
              {/* Logo + Profile Combined Header */}
              <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className={`flex items-center gap-3 mb-4 ${isCollapsed ? 'justify-center' : ''}`}>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 blob-morph flex-shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gradient">AI SDR</h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Outbound Excellence</p>
                    </div>
                  )}
                </div>
                {/* User Profile with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group ${isCollapsed ? 'justify-center' : ''}`}>
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20 transition-transform duration-200 group-hover:scale-105 flex-shrink-0">
                        <span className="text-sm font-semibold text-white">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </span>
                      </div>
                      {!isCollapsed && (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.companyName || user?.email}</p>
                          </div>
                          <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors flex-shrink-0" />
                        </>
                      )}
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 shadow-xl">
                    <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-200/50 dark:bg-slate-700/50" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Navigation - Modern with Micro-interactions */}
              <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon

                  const navLink = (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out ${isCollapsed ? 'justify-center px-3' : ''} ${isActive
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10 dark:hover:from-blue-500/20 dark:hover:to-purple-500/20'
                        }`}
                    >
                      <div className={`p-2 rounded-lg transition-all duration-300 ${isActive
                        ? 'bg-white/20'
                        : 'bg-slate-100 dark:bg-slate-800/50 group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30 group-hover:shadow-lg group-hover:shadow-blue-500/10'
                        }`}>
                        <Icon className={`w-4 h-4 transition-all duration-300 ${isActive
                          ? 'text-white'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110'
                          }`} />
                      </div>
                      {!isCollapsed && (
                        <span className={`text-sm font-medium transition-colors duration-300 ${isActive
                          ? 'text-white'
                          : 'group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}>
                          {item.name}
                        </span>
                      )}
                    </Link>
                  )

                  // Show tooltip when collapsed
                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          {navLink}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return navLink
                })}
              </nav>

              {/* Bottom Section - Theme Toggle + Collapse Button */}
              <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
                {/* Theme Toggle */}
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}`}>
                  <ThemeToggle />
                </div>

                {/* Collapse Toggle Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleSidebar}
                      className="flex items-center justify-center p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-200"
                    >
                      {isCollapsed ? (
                        <PanelLeft className="w-4 h-4" />
                      ) : (
                        <PanelLeftClose className="w-4 h-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
                      Expand sidebar
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content with Premium Spacing */}
        <main className={`min-h-screen transition-all duration-300 ease-out ${isCollapsed ? 'ml-32' : 'ml-80'}`}>
          <div className="p-8 max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}

