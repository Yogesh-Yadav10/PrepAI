
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, ArrowLeft, LoaderCircle, CheckCircle } from 'lucide-react'
import api from '../api/axios'

function TextTest() {
  const navigate = useNavigate()

  const [selectedRole, setSelectedRole] = useState('')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [interviewId, setInterviewId] = useState(null)
  const [result, setResult] = useState(null)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const roles = [
    'Python Developer',
    'Java Developer',
    'AI/ML Engineer',
    'Full Stack Developer',
    'Pharma Production',
  ]

  // Create session and fetch questions
  const handleStartTest = async () => {
    if (!selectedRole) {
      setError('Please select your role.')
      return
    }

    try {
      setLoading(true)
      setError('')

      const sessionResponse = await api.post('/interviews', {
        role: selectedRole,
        experience: 'Fresher',
        interview_mode: 'mock_interview',
        question_format: 'text',
      })

      const newInterviewId = sessionResponse.data.interview_id
      setInterviewId(newInterviewId)

      const questionResponse = await api.get(
        `/interviews/${newInterviewId}/questions`
      )

      setQuestions(questionResponse.data.questions)
      setCurrentIndex(0)
      setAnswers({})
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Unable to start the test.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Save current answer in React state
  const handleAnswerChange = (value) => {
    const questionId = questions[currentIndex].id

    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }))
  }

  // Submit all five answers and get final report
  const handleSubmitTest = async () => {
    const unanswered = questions.filter(
      (question) => !answers[question.id]?.trim()
    )

    if (unanswered.length > 0) {
      setError('Please answer all 5 questions before submitting.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      // Submit each answer to FastAPI
      for (const question of questions) {
        await api.post('/interviews/answers', {
          interview_id: interviewId,
          question_id: question.id,
          user_answer: answers[question.id],
        })
      }

      // Mark interview as completed
      await api.patch(`/interviews/${interviewId}/complete`)

      // Fetch final report
      const summaryResponse = await api.get(
        `/interviews/${interviewId}/summary`
      )

      setResult(summaryResponse.data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Unable to submit test. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const currentQuestion = questions[currentIndex]

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      <header className="border-b border-slate-800 px-5 py-5">
        <div className="w-full flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            Prep<span className="text-blue-500">AI</span>
          </h1>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft size={18} />
            Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12">

        <div className="text-center mb-10">
          <BrainCircuit size={40} className="mx-auto text-blue-400 mb-4" />
          <h2 className="text-3xl font-bold mb-3">Text Based Test</h2>
          <p className="text-slate-400">
            Test your knowledge with Interview questions.
          </p>
        </div>

        {/* Role Selection Only */}
        {questions.length === 0 && !result && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-7">

            <label className="block font-semibold mb-3">
              Select Your Role
            </label>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4"
            >
              <option value="">Choose a role</option>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            {error && (
              <p className="text-red-400 mt-4">{error}</p>
            )}

            <button
              onClick={handleStartTest}
              disabled={loading}
              className="w-full mt-7 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl py-4 font-semibold flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin" size={20} />
                  Generating Questions...
                </>
              ) : 'Start Test'}
            </button>
          </section>
        )}

        {/* One Question at a Time */}
        {questions.length > 0 && !result && currentQuestion && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-7">

            <div className="flex justify-between items-center mb-4">
              <p className="text-slate-300 font-semibold">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <p className="text-blue-400 text-sm">
                {Object.values(answers).filter(a => a.trim()).length} Answered
              </p>
            </div>

            <div className="w-full bg-slate-700 h-2 rounded-full mb-8">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                }}
              />
            </div>

            <p className="text-blue-400 mb-3">
              Question {currentIndex + 1}
            </p>

            <h3 className="text-xl font-semibold leading-relaxed mb-7">
              {currentQuestion.question_text}
            </h3>

            <label className="block font-semibold mb-3">
              Your Answer
            </label>

            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Write your answer here..."
              rows={7}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 resize-y"
            />

            {error && (
              <p className="text-red-400 mt-4">{error}</p>
            )}

            <div className="flex justify-between gap-4 mt-7">

              <button
                onClick={() => {
                  setError('')
                  setCurrentIndex((index) => index - 1)
                }}
                disabled={currentIndex === 0 || submitting}
                className="px-6 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
              >
                Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => {
                    setError('')
                    setCurrentIndex((index) => index + 1)
                  }}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmitTest}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Evaluating...
                    </>
                  ) : 'Submit Test'}
                </button>
              )}

            </div>
          </section>
        )}

        {/* Final Report */}
        {result && (
          <section className="space-y-6">

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 text-center">
              <CheckCircle size={45} className="mx-auto text-green-400 mb-4" />
              <h2 className="text-2xl font-bold">Test Completed!</h2>
              <p className="text-slate-400 mt-2">
                {result.role}
              </p>

              <p className="text-5xl font-bold text-blue-400 mt-6">
                {result.average_score}/100
              </p>
              <p className="text-slate-400 mt-2">Average Score</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-slate-400">Questions</p>
                <h3 className="text-2xl font-bold">{result.total_questions}</h3>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-slate-400">Attempted</p>
                <h3 className="text-2xl font-bold">{result.attempted}</h3>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-slate-400">Status</p>
                <h3 className="text-2xl font-bold text-green-400">Completed</h3>
              </div>
            </div>

            {[
              { title: 'Strengths', items: result.strengths },
              { title: 'Weaknesses', items: result.weaknesses },
              { title: 'Improvement Suggestions', items: result.improvement_suggestions },
            ].map((section) => (
              <div key={section.title} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-3">{section.title}</h3>
                {section.items?.length ? (
                  <ul className="list-disc pl-5 space-y-2 text-slate-300">
                    {section.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">No details available.</p>
                )}
              </div>
            ))}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-5">Question-wise Evaluation</h3>

              {result.question_reports.map((report, index) => (
                <div key={report.question_id} className="border-b border-slate-800 py-5 last:border-0">
                  <p className="text-blue-400 mb-2">Question {index + 1}</p>
                  <p className="font-semibold">{report.question}</p>

                  <p className="text-slate-400 mt-3">Your Answer:</p>
                  <p className="text-slate-300 whitespace-pre-wrap">{report.your_answer}</p>

                  <p className="text-green-400 mt-3">
                    Score: {report.score}/100
                  </p>

                  {report.evaluation.overall_feedback && (
                    <p className="text-slate-300 mt-2">
                      {report.evaluation.overall_feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-4 font-semibold"
            >
              Back to Dashboard
            </button>

          </section>
        )}

      </main>
    </div>
  )
}

export default TextTest
