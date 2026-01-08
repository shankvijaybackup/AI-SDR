'use client';

import { usePersona } from '@/context/persona-context';
import { SALES_PERSONAS, type SalesPersona } from '@/lib/learning/constants';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCircle, ChevronDown, Briefcase, Code, Users } from 'lucide-react';

const PERSONA_ICONS: Record<SalesPersona, React.ReactNode> = {
    AE: <Briefcase className="h-4 w-4" />,
    SC: <Code className="h-4 w-4" />,
    PARTNER: <Users className="h-4 w-4" />
};

const PERSONA_COLORS: Record<SalesPersona, string> = {
    AE: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    SC: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    PARTNER: 'bg-green-100 text-green-700 hover:bg-green-200'
};

interface PersonaSelectorProps {
    variant?: 'default' | 'compact';
    className?: string;
}

export function PersonaSelector({ variant = 'default', className }: PersonaSelectorProps) {
    const { persona, setPersona, personaInfo } = usePersona();

    if (variant === 'compact') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-2 ${PERSONA_COLORS[persona]} ${className}`}
                    >
                        {PERSONA_ICONS[persona]}
                        {personaInfo.shortName}
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {(Object.keys(SALES_PERSONAS) as SalesPersona[]).map((key) => (
                        <DropdownMenuItem
                            key={key}
                            onClick={() => setPersona(key)}
                            className={`gap-2 ${persona === key ? 'bg-muted' : ''}`}
                        >
                            {PERSONA_ICONS[key]}
                            {SALES_PERSONAS[key].name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <label className="text-sm font-medium text-muted-foreground">
                Your Role
            </label>
            <div className="flex gap-2">
                {(Object.keys(SALES_PERSONAS) as SalesPersona[]).map((key) => (
                    <Button
                        key={key}
                        variant={persona === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPersona(key)}
                        className={`gap-2 ${persona === key ? '' : 'text-muted-foreground'}`}
                    >
                        {PERSONA_ICONS[key]}
                        {SALES_PERSONAS[key].name}
                    </Button>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                Focus: {personaInfo.focus}
            </p>
        </div>
    );
}

// Badge variant for inline display
export function PersonaBadge({ persona }: { persona: SalesPersona }) {
    const info = SALES_PERSONAS[persona];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${PERSONA_COLORS[persona]}`}>
            {PERSONA_ICONS[persona]}
            {info.shortName}
        </span>
    );
}
