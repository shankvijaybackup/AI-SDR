'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    User,
    Briefcase,
    Target,
    MessageSquare,
    Lightbulb,
    TrendingUp,
    AlertCircle,
    Building2,
    Hash,
    Sparkles,
    CheckCircle2,
    Brain,
    Zap,
    Shield,
    HelpCircle,
    XCircle
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface SynthesizedValue {
    value: string
    source: 'claude' | 'openai' | 'fallback'
    confidence: 'high' | 'medium' | 'low'
    alternativeView?: string
}

interface SynthesizedArrayItem {
    text: string
    source: 'claude' | 'openai' | 'fallback'
    confidence: 'high' | 'medium' | 'low'
}

interface Metadata {
    approach: string
    models: string[]
    timestamp: string
    validationScore?: {
        claudeVerified: number
        openaiVerified: number
        consensusRate: number
    }
}

interface PersonaData {
    metadata?: Metadata
    discProfile?: SynthesizedValue | string
    discDescription?: SynthesizedValue | string
    communicationStyle?: SynthesizedValue | string
    executiveSnapshot?: {
        roleAndFocus?: SynthesizedValue
        coreStrengths?: SynthesizedArrayItem[]
        personaRead?: SynthesizedValue
    }
    strategicPrep?: {
        connectionAngle?: SynthesizedValue
        commonGround?: SynthesizedValue
        smartQuestions?: SynthesizedArrayItem[]
    }
    internalCoaching?: {
        howToWin?: SynthesizedArrayItem[]
        pitfallsAvoid?: SynthesizedArrayItem[]
    }
    likelyPainPoints?: SynthesizedArrayItem[]
    motivators?: SynthesizedArrayItem[]
    talkingPoints?: SynthesizedArrayItem[]
    decisionMakingStyle?: SynthesizedValue
    expectedObjections?: SynthesizedArrayItem[]
}

interface LeadPersonaDisplayProps {
    linkedinData: {
        persona?: PersonaData
        [key: string]: any
    } | null
    compact?: boolean
}

const SOURCE_COLORS = {
    claude: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', icon: Brain },
    openai: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', icon: Zap },
    fallback: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', icon: Shield }
}

const CONFIDENCE_COLORS = {
    high: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    low: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
}

function SourceBadge({ source, size = 'sm' }: { source: 'claude' | 'openai' | 'fallback', size?: 'sm' | 'xs' }) {
    const config = SOURCE_COLORS[source]
    const Icon = config.icon
    const sizeClasses = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'

    return (
        <Badge className={`${config.bg} ${config.text} ${config.border} border ${sizeClasses} font-medium`}>
            <Icon className={`${size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} mr-1`} />
            {source === 'claude' ? 'Claude' : source === 'openai' ? 'OpenAI' : 'Default'}
        </Badge>
    )
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
    const config = CONFIDENCE_COLORS[confidence]
    const Icon = confidence === 'high' ? CheckCircle2 : confidence === 'medium' ? AlertCircle : XCircle

    return (
        <Badge className={`${config.bg} ${config.text} ${config.border} border text-xs px-2 py-0.5`}>
            <Icon className="w-3 h-3 mr-1" />
            {confidence}
        </Badge>
    )
}

function getValue(item: SynthesizedValue | string | undefined | any): string {
    if (!item) return ''
    if (typeof item === 'string') return item
    if (typeof item === 'object' && item !== null) {
        return item.value || item.text || String(item)
    }
    return String(item)
}

function getSource(item: SynthesizedValue | string | undefined): 'claude' | 'openai' | 'fallback' {
    if (!item || typeof item === 'string') return 'fallback'
    return item.source || 'fallback'
}

function getConfidence(item: SynthesizedValue | string | undefined): 'high' | 'medium' | 'low' {
    if (!item || typeof item === 'string') return 'medium'
    return item.confidence || 'medium'
}

// Helper to normalize arrays - handles both old (string[]) and new (SynthesizedArrayItem[]) formats
function normalizeArray(arr: any[] | undefined): SynthesizedArrayItem[] {
    if (!arr || !Array.isArray(arr)) return []
    return arr.map(item => {
        if (typeof item === 'string') {
            return { text: item, source: 'fallback' as const, confidence: 'medium' as const }
        }
        if (typeof item === 'object' && item !== null) {
            return {
                text: item.text || item.value || String(item),
                source: item.source || 'fallback',
                confidence: item.confidence || 'medium'
            }
        }
        return { text: String(item), source: 'fallback' as const, confidence: 'medium' as const }
    })
}

export default function LeadPersonaDisplay({ linkedinData, compact = false }: LeadPersonaDisplayProps) {
    if (!linkedinData?.persona) {
        return (
            <div className="text-center py-8 text-slate-400">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No LinkedIn data available</p>
                <p className="text-sm">Enrich this lead to see their persona</p>
            </div>
        )
    }

    const rawPersona = linkedinData.persona as any
    const metadata = rawPersona.metadata

    // Check if this is multi-model synthesis
    const isMultiModel = metadata?.approach === 'multi-model-synthesis'

    // Normalize old structure to new structure for backward compatibility
    const persona: PersonaData = {
        ...rawPersona,
        motivators: normalizeArray(rawPersona.motivators),
        likelyPainPoints: normalizeArray(rawPersona.painPoints || rawPersona.likelyPainPoints),
        talkingPoints: normalizeArray(rawPersona.talkingPoints),
        strategicPrep: {
            smartQuestions: normalizeArray(rawPersona.strategicPrep?.smartQuestions),
            connectionAngle: rawPersona.strategicPrep?.connectionAngle,
            commonGround: rawPersona.strategicPrep?.commonGround,
        },
        internalCoaching: {
            howToWin: normalizeArray(rawPersona.internalCoaching?.howToWin),
            pitfallsAvoid: normalizeArray(rawPersona.internalCoaching?.pitfallsAvoid),
        },
    }

    return (
        <div className="space-y-6">
            {/* Metadata Banner */}
            {isMultiModel && metadata && (
                <Card className="bg-gradient-to-r from-purple-50 to-emerald-50 border-2 border-purple-200">
                    <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    <h3 className="text-lg font-semibold text-slate-900">Multi-Model AI Synthesis</h3>
                                </div>
                                <p className="text-sm text-slate-600">
                                    Cross-validated insights from <strong>Claude Opus 4.5</strong> and <strong>OpenAI GPT-4o</strong>
                                </p>
                                {metadata.validationScore && (
                                    <div className="flex items-center space-x-4 text-xs text-slate-600 mt-3">
                                        <div className="flex items-center">
                                            <Brain className="w-3.5 h-3.5 mr-1 text-purple-600" />
                                            <span>{metadata.validationScore.claudeVerified} verified claims</span>
                                        </div>
                                        <div className="flex items-center">
                                            <Zap className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                            <span>{metadata.validationScore.openaiVerified} verified claims</span>
                                        </div>
                                        <div className="flex items-center">
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                                            <span>{metadata.validationScore.consensusRate.toFixed(0)}% consensus</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Badge className="bg-white text-slate-700 border-slate-300">
                                <Shield className="w-3 h-3 mr-1" />
                                Verified
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* DISC Profile */}
            {persona.discProfile && (
                <Card className="border-2 border-indigo-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg flex items-center">
                                    <User className="w-5 h-5 mr-2 text-indigo-600" />
                                    Personality Profile (DISC)
                                </CardTitle>
                                <CardDescription>{getValue(persona.discDescription)}</CardDescription>
                            </div>
                            <div className="flex flex-col items-end space-y-1">
                                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 border text-lg px-3 py-1">
                                    {getValue(persona.discProfile)}
                                </Badge>
                                {isMultiModel && <SourceBadge source={getSource(persona.discProfile)} size="xs" />}
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            )}

            {/* Communication Style */}
            {persona.communicationStyle && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-md flex items-center">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Communication Style
                            </CardTitle>
                            {isMultiModel && (
                                <div className="flex space-x-1">
                                    <SourceBadge source={getSource(persona.communicationStyle)} size="xs" />
                                    <ConfidenceBadge confidence={getConfidence(persona.communicationStyle)} />
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-700 leading-relaxed">{getValue(persona.communicationStyle)}</p>
                    </CardContent>
                </Card>
            )}

            {/* Executive Snapshot */}
            {persona.executiveSnapshot && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <Briefcase className="w-4 h-4 mr-2" />
                            Executive Snapshot
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {persona.executiveSnapshot.roleAndFocus && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-medium text-slate-700">Role & Focus</h4>
                                    {isMultiModel && (
                                        <SourceBadge source={getSource(persona.executiveSnapshot.roleAndFocus)} size="xs" />
                                    )}
                                </div>
                                <p className="text-sm text-slate-600">{getValue(persona.executiveSnapshot.roleAndFocus)}</p>
                            </div>
                        )}
                        {persona.executiveSnapshot.coreStrengths && persona.executiveSnapshot.coreStrengths.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-2">Core Strengths</h4>
                                <div className="space-y-2">
                                    {persona.executiveSnapshot.coreStrengths.map((strength, idx) => (
                                        <div key={idx} className="flex items-start space-x-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-sm text-slate-700">{strength.text}</p>
                                                {isMultiModel && (
                                                    <SourceBadge source={strength.source} size="xs" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {persona.executiveSnapshot.personaRead && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-medium text-indigo-900">Persona Read</h4>
                                    {isMultiModel && (
                                        <SourceBadge source={getSource(persona.executiveSnapshot.personaRead)} size="xs" />
                                    )}
                                </div>
                                <p className="text-sm text-indigo-800">{getValue(persona.executiveSnapshot.personaRead)}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Smart Questions */}
            {persona.strategicPrep?.smartQuestions && persona.strategicPrep.smartQuestions.length > 0 && (
                <Card className="border-2 border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <HelpCircle className="w-4 h-4 mr-2 text-blue-600" />
                            Smart Questions to Ask
                        </CardTitle>
                        <CardDescription>Ranked by detail and specificity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {persona.strategicPrep.smartQuestions.map((question, idx) => (
                                <div key={idx} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-800 leading-relaxed">{question.text}</p>
                                        {isMultiModel && (
                                            <div className="flex space-x-1 mt-2">
                                                <SourceBadge source={question.source} size="xs" />
                                                <ConfidenceBadge confidence={question.confidence} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* How to Win */}
            {persona.internalCoaching?.howToWin && persona.internalCoaching.howToWin.length > 0 && (
                <Card className="border-2 border-green-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                            How to Win
                        </CardTitle>
                        <CardDescription>Strategies for success</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {persona.internalCoaching.howToWin.map((tip, idx) => (
                                <div key={idx} className="flex items-start space-x-2 p-2 hover:bg-green-50 rounded transition-colors">
                                    <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">{tip.text}</p>
                                        {isMultiModel && (
                                            <div className="flex space-x-1 mt-1">
                                                <SourceBadge source={tip.source} size="xs" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pitfalls to Avoid */}
            {persona.internalCoaching?.pitfallsAvoid && persona.internalCoaching.pitfallsAvoid.length > 0 && (
                <Card className="border-2 border-red-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <XCircle className="w-4 h-4 mr-2 text-red-600" />
                            Pitfalls to Avoid
                        </CardTitle>
                        <CardDescription>What NOT to do</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {persona.internalCoaching.pitfallsAvoid.map((pitfall, idx) => (
                                <div key={idx} className="flex items-start space-x-2 p-2 hover:bg-red-50 rounded transition-colors">
                                    <span className="text-red-600 font-bold flex-shrink-0">✗</span>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">{pitfall.text}</p>
                                        {isMultiModel && (
                                            <div className="flex space-x-1 mt-1">
                                                <SourceBadge source={pitfall.source} size="xs" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pain Points */}
            {persona.likelyPainPoints && persona.likelyPainPoints.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
                            Likely Pain Points
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {persona.likelyPainPoints.map((pain, idx) => (
                                <div key={idx} className="flex items-start space-x-2 p-2 border-l-2 border-orange-300 pl-3">
                                    <span className="text-orange-500 mr-1">▸</span>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">{pain.text}</p>
                                        {isMultiModel && (
                                            <div className="flex space-x-1 mt-1">
                                                <SourceBadge source={pain.source} size="xs" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Motivators */}
            {persona.motivators && persona.motivators.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2 text-purple-600" />
                            Key Motivators
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {persona.motivators.map((motivator, idx) => (
                                <div key={idx} className="relative group">
                                    <Badge className="bg-purple-100 text-purple-700 border-purple-300 border text-sm px-3 py-1">
                                        {motivator.text}
                                    </Badge>
                                    {isMultiModel && (
                                        <div className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <SourceBadge source={motivator.source} size="xs" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Talking Points */}
            {persona.talkingPoints && persona.talkingPoints.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <Lightbulb className="w-4 h-4 mr-2 text-yellow-600" />
                            Conversation Starters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {persona.talkingPoints.map((point, idx) => (
                                <div key={idx} className="flex items-start space-x-2 p-2">
                                    <span className="text-yellow-600 font-bold flex-shrink-0">{idx + 1}.</span>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">{point.text}</p>
                                        {isMultiModel && (
                                            <div className="flex space-x-1 mt-1">
                                                <SourceBadge source={point.source} size="xs" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Expected Objections */}
            {persona.expectedObjections && persona.expectedObjections.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <Shield className="w-4 h-4 mr-2 text-slate-600" />
                            Expected Objections
                        </CardTitle>
                        <CardDescription>What they might say and how to respond</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {persona.expectedObjections.map((objection, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-start space-x-2">
                                        <span className="text-slate-500 font-bold">"</span>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-800 italic">{objection.text}</p>
                                            {isMultiModel && (
                                                <div className="flex space-x-1 mt-2">
                                                    <SourceBadge source={objection.source} size="xs" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-slate-500 font-bold">"</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Decision Making Style */}
            {persona.decisionMakingStyle && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-md flex items-center">
                                <Target className="w-4 h-4 mr-2" />
                                Decision-Making Style
                            </CardTitle>
                            {isMultiModel && (
                                <SourceBadge source={getSource(persona.decisionMakingStyle)} size="xs" />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-700 leading-relaxed">{getValue(persona.decisionMakingStyle)}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
