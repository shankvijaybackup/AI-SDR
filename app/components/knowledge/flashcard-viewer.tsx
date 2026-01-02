'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Flashcard {
    id: string
    front: string
    back: string
}

interface FlashcardViewerProps {
    cards: Flashcard[]
}

export function FlashcardViewer({ cards }: FlashcardViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)

    if (cards.length === 0) {
        return <div className="text-center text-muted-foreground">No flashcards availabe.</div>
    }

    const currentCard = cards[currentIndex]

    const handleNext = () => {
        setIsFlipped(false)
        setCurrentIndex((prev) => (prev + 1) % cards.length)
    }

    const handlePrev = () => {
        setIsFlipped(false)
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length)
    }

    const handleFlip = () => {
        setIsFlipped(!isFlipped)
    }

    return (
        <div className="flex flex-col items-center justify-center space-y-8 p-6">
            <div className="relative w-full h-[400px] perspective-1000" onClick={handleFlip}>
                <motion.div
                    className="w-full h-full relative preserve-3d cursor-pointer"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.6 }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* Front */}
                    <Card className="absolute w-full h-full backface-hidden flex items-center justify-center p-10 bg-card text-card-foreground shadow-xl border-primary/20 hover:border-primary/40 transition-colors">
                        <CardContent className="text-center">
                            <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Question</h3>
                            <p className="text-2xl font-medium">{currentCard.front}</p>
                        </CardContent>
                    </Card>

                    {/* Back */}
                    <Card
                        className="absolute w-full h-full backface-hidden flex items-center justify-center p-10 bg-primary text-primary-foreground shadow-xl"
                        style={{ transform: 'rotateY(180deg)' }}
                    >
                        <CardContent className="text-center">
                            <h3 className="text-sm uppercase tracking-wider text-primary-foreground/70 mb-4">Answer</h3>
                            <p className="text-xl leading-relaxed">{currentCard.back}</p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <div className="flex items-center space-x-4">
                <Button variant="outline" size="icon" onClick={handlePrev}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                    {currentIndex + 1} / {cards.length}
                </span>
                <Button variant="outline" size="icon" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RotateCw className="h-3 w-3" /> Click card to flip
            </p>
        </div>
    )
}
