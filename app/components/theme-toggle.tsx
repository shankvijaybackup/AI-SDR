'use client'

import * as React from 'react'
import { Palette, Check } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themes = [
    { name: 'Midnight Glass', value: 'midnight', color: 'bg-slate-900' },
    { name: 'Ocean Breeze', value: 'ocean', color: 'bg-sky-500' },
    { name: 'Sunset Glow', value: 'sunset', color: 'bg-orange-500' },
    { name: 'Forest Zen', value: 'forest', color: 'bg-emerald-600' },
    { name: 'Neon Cyber', value: 'neon', color: 'bg-green-400' },
    { name: 'Royal Amethyst', value: 'royal', color: 'bg-purple-600' },
]

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <Button variant="outline" size="icon">
                <Palette className="h-[1.2rem] w-[1.2rem]" />
            </Button>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="transition-all duration-300">
                    <Palette className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {themes.map((t) => (
                    <DropdownMenuItem key={t.value} onClick={() => setTheme(t.value)} className="cursor-pointer gap-2">
                        <div className={`h-4 w-4 rounded-full border border-slate-200 dark:border-slate-700 ${t.color}`} />
                        <span className="flex-1">{t.name}</span>
                        {theme === t.value && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

