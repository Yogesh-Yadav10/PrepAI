
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BrainCircuit,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  LoaderCircle,
  AlertCircle,
  Trophy,
  XCircle,
  Send,
} from 'lucide-react'

import api from '../api/axios'

function MCQTest() {
  const navigate = useNavigate()

  const [selectedTopic, setSelectedTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState([])
  const [interviewId, setInterviewId] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  const topics = [
    'OOPs',
    'DBMS',
    'Technical Fundamentals',
    'Operating Systems',
    'Computer Networks',
    'System Design',
    'DSA',
    'Pharma Production & GMP',
  ]

  // Create session and fetch questions
  async function handleStartTest() {
    if (!selectedTopic) {
      setError('Please select a topic first.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setQuestions([])
      setAnswers({})
      setResult(null)
      setInterviewId(null)
      setCurrentQuestion(0)

      // STEP 1: Create MCQ interview session
      const sessionResponse = await api.post('/interviews', {
        role: null,
        experience: 'Fresher',
        topics: selectedTopic,
        interview_mode: 'mcq_practice',
        question_format: 'mcq',
      })

      const newInterviewId = sessionResponse.data.interview_id

      setInterviewId(newInterviewId)

      // STEP 2: Fetch questions from backend
      const questionResponse = await api.get(
        `/interviews/${newInterviewId}/questions`
      )

      const fetchedQuestions = questionResponse.data.questions || []

      if (fetchedQuestions.length === 0) {
        setError('No questions available for this topic.')
        return
      }

      setQuestions(fetchedQuestions)

    } catch (err) {
      console.error('MCQ Test Error:', err)

      setError(
        err.response?.data?.detail ||
        'Unable to load questions. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Select an answer
  function handleAnswerSelect(questionId, optionKey) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: optionKey,
    }))
  }

  // Restart and select another topic
  function handleBackToTopics() {
    setQuestions([])
    setInterviewId(null)
    setAnswers({})
    setCurrentQuestion(0)
    setResult(null)
    setError('')
  }

  // Parse options safely
  function getOptions(options) {
    if (!options) return {}

    if (typeof options === 'string') {
      try {
        return JSON.parse(options)
      } catch {
        return {}
      }
    }

    return options
  }

  // Submit test and calculate result
  async function handleSubmitTest() {
    const unanswered = questions.filter(
      (question) => !answers[question.id]
    )

    if (unanswered.length > 0) {
      setError(
        `Please answer all ${questions.length} questions before submitting.`
      )
      return
    }

    try {
      setLoading(true)
      setError('')

      // STEP 1: Save all answers
      for (const question of questions) {
        await api.post('/interviews/answers', {
          interview_id: interviewId,
          question_id: question.id,
          user_answer: answers[question.id],
        })
      }

      // STEP 2: Complete interview
      await api.patch(`/interviews/${interviewId}/complete`)

      // STEP 3: Fetch final result
      const response = await api.get(
        `/interviews/${interviewId}/result`
      )

      setResult(response.data)

    } catch (err) {
      console.error('Submit Test Error:', err)

      setError(
        err.response?.data?.detail ||
        'Unable to submit test. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const question = questions[currentQuestion]
  const currentOptions = question ? getOptions(question.options) : {}

  // RESULT SCREEN
  if (result) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">

        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8">

          <div className="text-center">

            <Trophy
              size={44}
              className="mx-auto text-blue-400 mb-5"
            />

            <h1 className="text-3xl font-bold mb-2">
              Test Completed!
            </h1>

            <p className="text-slate-400">
              {result.topic}
            </p>

            <h2 className="text-6xl font-bold text-blue-400 my-7">
              {result.percentage}%
            </h2>

            <p className="text-slate-400">
              Score: {result.score}/{result.score_out_of}
            </p>

          </div>

          <div className="grid grid-cols-2 gap-4 my-8">

            <div className="bg-slate-800 rounded-2xl p-5 text-center">

              <CheckCircle2
                className="mx-auto text-emerald-400 mb-2"
                size={25}
              />

              <h3 className="text-2xl font-bold">
                {result.correct_answers}
              </h3>

              <p className="text-sm text-slate-400">
                Correct Answers
              </p>

            </div>

            <div className="bg-slate-800 rounded-2xl p-5 text-center">

              <XCircle
                className="mx-auto text-red-400 mb-2"
                size={25}
              />

              <h3 className="text-2xl font-bold">
                {result.incorrect_answers}
              </h3>

              <p className="text-sm text-slate-400">
                Incorrect Answers
              </p>

            </div>

          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 mb-8">

            <h3 className="font-semibold text-blue-400 mb-2">
              Overall Feedback
            </h3>

            <p className="text-slate-300 text-sm leading-relaxed">
              {result.overall_feedback}
            </p>

          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl py-4 font-semibold transition"
          >
            Back to Dashboard
          </button>

        </div>

      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Navbar */}
      <header className="border-b border-slate-800 px-5 sm:px-10 py-5">

        <div className="w-full flex items-center justify-between">

          <h1 className="text-2xl font-bold">
            Prep<span className="text-blue-500">AI</span>
          </h1>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft size={18} />
            Dashboard
          </button>

        </div>

      </header>

      <main className="max-w-5xl mx-auto px-5 py-12">

        {/* TOPIC SELECTION */}
        {questions.length === 0 && (

          <>
            <div className="text-center mb-12">

              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5">
                <BrainCircuit size={34} />
              </div>

              <p className="text-blue-400 text-sm font-semibold mb-3">
                AI POWERED PRACTICE
              </p>

              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                MCQ Based Test
              </h2>

              <p className="text-slate-400 max-w-xl mx-auto">
                Select a topic and test your knowledge with
                AI-generated multiple-choice questions.
              </p>

            </div>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">

              <div className="flex items-center gap-3 mb-2">

                <BookOpen className="text-blue-400" size={22} />

                <h3 className="text-xl font-semibold">
                  Select Your Topic
                </h3>

              </div>

              <p className="text-sm text-slate-400 mb-7">
                Choose one topic to begin your practice test.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {topics.map((topic) => {
                  const isSelected = selectedTopic === topic

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(topic)
                        setError('')
                      }}
                      className={`flex items-center justify-between text-left p-4 rounded-xl border transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                      }`}
                    >

                      <span className="font-medium text-sm sm:text-base">
                        {topic}
                      </span>

                      {isSelected && (
                        <CheckCircle2 size={20} />
                      )}

                    </button>
                  )
                })}

              </div>

              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex gap-2 items-start">

                  <AlertCircle size={19} className="shrink-0" />

                  <p className="text-sm">
                    {error}
                  </p>

                </div>
              )}

              <button
                type="button"
                onClick={handleStartTest}
                disabled={!selectedTopic || loading}
                className="w-full mt-8 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 transition"
              >

                {loading ? (
                  <>
                    <LoaderCircle size={20} className="animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  'Start Test'
                )}

              </button>

            </section>
          </>

        )}

        {/* QUESTIONS SECTION */}
        {questions.length > 0 && question && (

          <section>

            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">

              <div>

                <p className="text-blue-400 text-sm font-semibold">
                  MCQ PRACTICE
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  {selectedTopic}
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Interview ID: {interviewId}
                </p>

              </div>

              <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-xl text-sm font-semibold">
                {questions.length} Questions
              </div>

            </div>

            {/* Progress */}
            <div className="mb-6">

              <div className="flex justify-between text-sm text-slate-400 mb-2">

                <span>
                  Question {currentQuestion + 1} of {questions.length}
                </span>

                <span>
                  {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
                </span>

              </div>

              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">

                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${((currentQuestion + 1) / questions.length) * 100}%`,
                  }}
                />

              </div>

            </div>

            {/* Question Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">

              <p className="text-xs text-blue-400 font-semibold mb-4">
                QUESTION {currentQuestion + 1}
              </p>

              <h3 className="text-lg sm:text-xl font-semibold leading-relaxed mb-8">
                {question.question_text}
              </h3>

              <div className="space-y-3">

                {Object.entries(currentOptions).map(([key, value]) => {

                  const isSelected = answers[question.id] === key

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={loading}
                      onClick={() => handleAnswerSelect(question.id, key)}
                      className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                      }`}
                    >

                      <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center font-semibold ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {key}
                      </span>

                      <span className="text-sm sm:text-base">
                        {value}
                      </span>

                      {isSelected && (
                        <CheckCircle2
                          size={19}
                          className="ml-auto text-blue-400"
                        />
                      )}

                    </button>
                  )
                })}

              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex gap-2 items-start">

                  <AlertCircle size={19} className="shrink-0" />

                  <p className="text-sm">
                    {error}
                  </p>

                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between gap-4 mt-8">

                <button
                  type="button"
                  onClick={() => {
                    setCurrentQuestion((previous) => previous - 1)
                    setError('')
                  }}
                  disabled={currentQuestion === 0 || loading}
                  className="px-5 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition"
                >
                  Previous
                </button>

                {currentQuestion < questions.length - 1 ? (

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentQuestion((previous) => previous + 1)
                      setError('')
                    }}
                    disabled={loading}
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-30 transition"
                  >
                    Next Question
                  </button>

                ) : (

                  <button
                    type="button"
                    onClick={handleSubmitTest}
                    disabled={loading}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 transition flex items-center gap-2"
                  >

                    {loading ? (
                      <>
                        <LoaderCircle size={18} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Submit Test
                      </>
                    )}

                  </button>

                )}

              </div>

            </div>

            {/* Answer Count and Back */}
            <div className="flex justify-between items-center mt-6">

              <p className="text-xs text-slate-500">
                Answered: {Object.keys(answers).length} / {questions.length}
              </p>

              <button
                type="button"
                onClick={handleBackToTopics}
                disabled={loading}
                className="text-sm text-slate-400 hover:text-white underline disabled:opacity-50"
              >
                Back to Topics
              </button>

            </div>

          </section>

        )}

      </main>

    </div>
  )
}

export default MCQTest
