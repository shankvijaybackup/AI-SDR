'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // Prevent hydration mismatch
    React.useEffect(() => {
        setMounted(true)
    }, [])

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }

    if (!mounted) {
        return (
            <button className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="w-4 h-4" />
            </button>
        )
    }

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all duration-200"
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-yellow-500" />
            ) : (
                <Moon className="w-4 h-4 text-slate-600" />
            )}
        </button>
    )
}

