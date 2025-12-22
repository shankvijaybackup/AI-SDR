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
    Hash
} from 'lucide-react'

interface PersonaProfile {
    discProfile: string
    discDescription: string
    communicationStyle: string
    keyInterests: string[]
    focusAreas: string[]
    talkingPoints: string[]
    approachRecommendation: string
    painPoints?: string[]
    motivators?: string[]
}

interface CompanyInfo {
    name: string
    industry?: string
    size?: string
    website?: string
    description?: string
}

interface LinkedInPost {
    text: string
    date?: string
    topics?: string[]
    engagement?: {
        likes: number
        comments: number
    }
}

interface EnhancedLinkedInData {
    firstName?: string
    lastName?: string
    headline?: string
    summary?: string
    location?: string
    company?: string
    jobTitle?: string
    companyInfo?: CompanyInfo
    skills?: string[]
    recentPosts?: LinkedInPost[]
    persona?: PersonaProfile
}

interface LeadPersonaDisplayProps {
    linkedinData: EnhancedLinkedInData | null
    compact?: boolean
}

const DISC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    D: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    I: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    S: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    C: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    DI: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    DC: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    IS: { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
    SC: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
}

const DISC_LABELS: Record<string, string> = {
    D: 'Dominant',
    I: 'Influential',
    S: 'Steady',
    C: 'Conscientious',
    DI: 'Driver',
    DC: 'Analyst',
    IS: 'Supporter',
    SC: 'Specialist',
}

export default function LeadPersonaDisplay({ linkedinData, compact = false }: LeadPersonaDisplayProps) {
    if (!linkedinData) {
        return (
            <div className="text-center py-8 text-slate-400">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No LinkedIn data available</p>
                <p className="text-sm">Enrich this lead to see their persona</p>
            </div>
        )
    }

    const persona = linkedinData.persona
    const discType = persona?.discProfile || 'C'
    const colors = DISC_COLORS[discType] || DISC_COLORS.C

    if (compact) {
        return (
            <div className="space-y-3">
                {/* DISC Badge */}
                {persona && (
                    <div className="flex items-center space-x-2">
                        <Badge className={`${colors.bg} ${colors.text} ${colors.border} border`}>
                            {discType} - {DISC_LABELS[discType] || 'Unknown'}
                        </Badge>
                        <span className="text-sm text-slate-500">{persona.communicationStyle}</span>
                    </div>
                )}

                {/* Quick Summary */}
                {linkedinData.headline && (
                    <p className="text-sm text-slate-600 italic">"{linkedinData.headline}"</p>
                )}

                {/* Company */}
                {linkedinData.companyInfo && (
                    <div className="flex items-center text-sm text-slate-500">
                        <Building2 className="w-4 h-4 mr-2" />
                        {linkedinData.companyInfo.name}
                        {linkedinData.companyInfo.industry && ` • ${linkedinData.companyInfo.industry}`}
                    </div>
                )}

                {/* Top Skills */}
                {linkedinData.skills && linkedinData.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {linkedinData.skills.slice(0, 4).map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                                {skill}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* DISC Profile Card */}
            {persona && (
                <Card className={`${colors.border} border-2`}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center">
                                <User className="w-5 h-5 mr-2" />
                                Personality Profile
                            </CardTitle>
                            <Badge className={`${colors.bg} ${colors.text} ${colors.border} border text-lg px-3 py-1`}>
                                {discType}
                            </Badge>
                        </div>
                        <CardDescription>{persona.discDescription}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Communication Style */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 flex items-center mb-1">
                                <MessageSquare className="w-4 h-4 mr-1" /> Communication Style
                            </h4>
                            <p className="text-sm text-slate-600">{persona.communicationStyle}</p>
                        </div>

                        {/* Approach Recommendation */}
                        <div className={`p-3 rounded-lg ${colors.bg}`}>
                            <h4 className={`text-sm font-medium ${colors.text} mb-1`}>How to Approach</h4>
                            <p className={`text-sm ${colors.text}`}>{persona.approachRecommendation}</p>
                        </div>

                        {/* Focus Areas */}
                        {persona.focusAreas && persona.focusAreas.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 flex items-center mb-2">
                                    <Target className="w-4 h-4 mr-1" /> Focus Areas
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {persona.focusAreas.map((area, idx) => (
                                        <Badge key={idx} variant="secondary">{area}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pain Points */}
                        {persona.painPoints && persona.painPoints.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 flex items-center mb-2">
                                    <AlertCircle className="w-4 h-4 mr-1" /> Likely Pain Points
                                </h4>
                                <ul className="text-sm text-slate-600 space-y-1">
                                    {persona.painPoints.map((pain, idx) => (
                                        <li key={idx} className="flex items-start">
                                            <span className="text-red-400 mr-2">•</span>
                                            {pain}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Motivators */}
                        {persona.motivators && persona.motivators.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 flex items-center mb-2">
                                    <TrendingUp className="w-4 h-4 mr-1" /> Motivators
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {persona.motivators.map((mot, idx) => (
                                        <Badge key={idx} variant="outline" className="text-green-600 border-green-300">
                                            {mot}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Talking Points */}
            {persona?.talkingPoints && persona.talkingPoints.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Lightbulb className="w-5 h-5 mr-2" />
                            Talking Points
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {persona.talkingPoints.map((point, idx) => (
                                <li key={idx} className="flex items-start text-sm">
                                    <span className="text-blue-500 mr-2 font-bold">{idx + 1}.</span>
                                    <span className="text-slate-600">{point}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Company Info */}
            {linkedinData.companyInfo && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Building2 className="w-5 h-5 mr-2" />
                            Company: {linkedinData.companyInfo.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {linkedinData.companyInfo.industry && (
                            <p><span className="text-slate-500">Industry:</span> {linkedinData.companyInfo.industry}</p>
                        )}
                        {linkedinData.companyInfo.size && (
                            <p><span className="text-slate-500">Size:</span> {linkedinData.companyInfo.size}</p>
                        )}
                        {linkedinData.companyInfo.description && (
                            <p className="text-slate-600 italic">{linkedinData.companyInfo.description}</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Recent Posts */}
            {linkedinData.recentPosts && linkedinData.recentPosts.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Hash className="w-5 h-5 mr-2" />
                            Recent Activity
                        </CardTitle>
                        <CardDescription>What they're posting about on LinkedIn</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {linkedinData.recentPosts.slice(0, 3).map((post, idx) => (
                            <div key={idx} className="border-l-2 border-blue-200 pl-3">
                                <p className="text-sm text-slate-600 line-clamp-2">{post.text}</p>
                                {post.topics && post.topics.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {post.topics.map((topic, tidx) => (
                                            <span key={tidx} className="text-xs text-blue-500">#{topic}</span>
                                        ))}
                                    </div>
                                )}
                                {post.engagement && (
                                    <p className="text-xs text-slate-400 mt-1">
                                        {post.engagement.likes} likes • {post.engagement.comments} comments
                                    </p>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Skills */}
            {linkedinData.skills && linkedinData.skills.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Briefcase className="w-5 h-5 mr-2" />
                            Key Skills
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {linkedinData.skills.slice(0, 10).map((skill, idx) => (
                                <Badge key={idx} variant="outline">{skill}</Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
