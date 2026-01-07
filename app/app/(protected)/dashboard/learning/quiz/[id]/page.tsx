
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, ChevronRight, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface Question {
    id: string
    question: string
    options: string[]
    type: string
}

interface Quiz {
    id: string
    title: string
    description: string
    questions: Question[]
}

interface QuizResult {
    score: number;
    results: {
        questionId: string;
        isCorrect: boolean;
        correctAnswer: string;
        explanation: string;
    }[];
}

export default function QuizPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const { id } = params

    const [quiz, setQuiz] = useState<Quiz | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState<QuizResult | null>(null)

    useEffect(() => {
        fetch(`/api/learning/quiz/${id}`)
            .then(res => res.json())
            .then(data => {
                setQuiz(data.quiz)
                setLoading(false)
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id])

    const handleAnswer = (value: string) => {
        if (quiz) {
            setAnswers(prev => ({ ...prev, [quiz.questions[currentQuestionIndex].id]: value }))
        }
    }

    const handleNext = () => {
        if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1)
        }
    }

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1)
        }
    }

    const handleSubmit = async () => {
        if (!quiz) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/learning/quiz/${id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers })
            });
            const data = await res.json();
            setResult(data);
        } catch (e) {
            console.error(e);
            alert("Failed to submit quiz");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <div className="p-10 text-center">Loading quiz...</div>
    if (!quiz) return <div className="p-10 text-center text-red-500">Quiz not found</div>

    // Show Results
    if (result) {
        return (
            <div className="max-w-3xl mx-auto space-y-6 pt-8">
                <Card className="border-t-4 border-t-blue-600">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl">Quiz Results</CardTitle>
                        <CardDescription>You scored {result.score}%</CardDescription>
                        <Progress value={result.score} className="w-full h-4 mt-4" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {quiz.questions.map((q, idx) => {
                            const res = result.results.find(r => r.questionId === q.id);
                            return (
                                <div key={q.id} className="p-4 rounded-lg border bg-slate-50">
                                    <div className="flex items-start gap-3">
                                        {res?.isCorrect ? <CheckCircle className="text-green-500 w-6 h-6 shrink-0" /> : <XCircle className="text-red-500 w-6 h-6 shrink-0" />}
                                        <div>
                                            <p className="font-medium text-lg mb-2">{idx + 1}. {q.question}</p>
                                            <p className="text-sm text-slate-600 mb-2">Your Answer: <span className="font-semibold">{answers[q.id]}</span></p>
                                            {!res?.isCorrect && (
                                                <div className="ml-1 text-sm bg-red-50 text-red-700 p-2 rounded">
                                                    <p><span className="font-bold">Correct Answer:</span> {res?.correctAnswer}</p>
                                                    <p className="mt-1"><span className="font-bold">Explanation:</span> {res?.explanation}</p>
                                                </div>
                                            )}
                                            {res?.isCorrect && <p className="text-sm text-green-600 italic">{res.explanation}</p>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </CardContent>
                    <CardFooter className="justify-center">
                        <Button onClick={() => router.push('/knowledge')}>Back to Knowledge Hub</Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    const currentQuestion = quiz.questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

    return (
        <div className="max-w-2xl mx-auto pt-10">
            <div className="mb-4 flex justify-between items-center text-sm text-slate-500">
                <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
                <span>{Math.round(((currentQuestionIndex) / quiz.questions.length) * 100)}% Completed</span>
            </div>
            <Progress value={((currentQuestionIndex) / quiz.questions.length) * 100} className="mb-8" />

            <Card className="min-h-[400px] flex flex-col">
                <CardHeader>
                    <CardTitle className="text-xl leading-relaxed">{currentQuestion.question}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                    <RadioGroup value={answers[currentQuestion.id] || ""} onValueChange={handleAnswer} className="space-y-3">
                        {currentQuestion.options.map((option, idx) => (
                            <div key={idx} className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${answers[currentQuestion.id] === option ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                                <RadioGroupItem value={option} id={`opt-${idx}`} />
                                <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer font-normal text-base">{option}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="flex justify-between border-t bg-slate-50/50 p-6">
                    <Button variant="outline" onClick={handlePrev} disabled={currentQuestionIndex === 0}>
                        Previous
                    </Button>

                    {isLastQuestion ? (
                        <Button onClick={handleSubmit} disabled={submitting || Object.keys(answers).length !== quiz.questions.length}>
                            {submitting ? "Submitting..." : "Submit Quiz"}
                        </Button>
                    ) : (
                        <Button onClick={handleNext} disabled={!answers[currentQuestion.id]}>
                            Next <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
