'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SALES_PERSONAS, type SalesPersona } from '@/lib/learning/constants';

interface PersonaContextType {
    persona: SalesPersona;
    setPersona: (p: SalesPersona) => void;
    personaInfo: typeof SALES_PERSONAS[SalesPersona];
}

const PersonaContext = createContext<PersonaContextType>({
    persona: 'AE',
    setPersona: () => { },
    personaInfo: SALES_PERSONAS.AE
});

export function PersonaProvider({ children }: { children: ReactNode }) {
    const [persona, setPersonaState] = useState<SalesPersona>('AE');

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('salesPersona') as SalesPersona | null;
        if (saved && saved in SALES_PERSONAS) {
            setPersonaState(saved);
        }
    }, []);

    const setPersona = (p: SalesPersona) => {
        setPersonaState(p);
        localStorage.setItem('salesPersona', p);

        // Optionally sync to backend
        fetch('/api/user/persona', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ persona: p })
        }).catch(console.error);
    };

    return (
        <PersonaContext.Provider
            value={{
                persona,
                setPersona,
                personaInfo: SALES_PERSONAS[persona]
            }}
        >
            {children}
        </PersonaContext.Provider>
    );
}

export const usePersona = () => useContext(PersonaContext);
