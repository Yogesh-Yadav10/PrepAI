
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BrainCircuit,
  MessageSquareText,
  History as HistoryIcon,
  LoaderCircle,
} from 'lucide-react'
import api from '../api/axios'

function History() {
  const navigate = useNavigate()

  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/users/me/interviews/history')
        setHistory(response.data)
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          'Unable to load interview history.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  const mcqHistory = history?.mcq_practice_history || []
  const textHistory = history?.mock_interview_history || []

  // MCQ overall accuracy
  const totalMcqAttempted = mcqHistory.reduce(
    (sum, item) => sum + (item.attempted || 0), 0
  )

  const totalMcqCorrect = mcqHistory.reduce(
    (sum, item) => sum + (item.correct_answers || 0), 0
  )

  const mcqAccuracy = totalMcqAttempted > 0
    ? (totalMcqCorrect / totalMcqAttempted) * 100
    : 0

  // Text overall average score, weighted by attempted answers
  const totalTextAttempted = textHistory.reduce(
    (sum, item) => sum + (item.attempted || 0), 0
  )

  const textWeightedScore = textHistory.reduce(
    (sum, item) => sum + (
      item.average_score != null
        ? item.average_score * (item.attempted || 0)
        : 0
    ), 0
  )

  const textAverage = totalTextAttempted > 0
    ? textWeightedScore / totalTextAttempted
    : 0

  const stats = [
    {
      title: 'MCQ Tests',
      value: mcqHistory.length,
      subtitle: 'Total tests attempted',
      icon: BrainCircuit,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'MCQ Accuracy',
      value: `${mcqAccuracy.toFixed(1)}%`,
      subtitle: 'Overall correct answers',
      icon: BrainCircuit,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      title: 'Text Based Tests',
      value: textHistory.length,
      subtitle: 'Total tests attempted',
      icon: MessageSquareText,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Text Average Score',
      value: `${textAverage.toFixed(1)}%`,
      subtitle: 'Overall answer score',
      icon: MessageSquareText,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      <header className="border-b border-slate-800 px-5 py-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
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

      <main className="max-w-6xl mx-auto px-5 py-12">

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <HistoryIcon size={32} className="text-blue-400" />
            <h2 className="text-3xl font-bold">Test History</h2>
          </div>

          <p className="text-slate-400">
            Your overall MCQ and Text Based Test performance.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 gap-3 text-slate-400">
            <LoaderCircle className="animate-spin" />
            Loading your history...
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400">
            {error}
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {stats.map((stat) => {
                const Icon = stat.icon

                return (
                  <div
                    key={stat.title}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
                  >
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <p className="text-slate-400 text-sm">
                          {stat.title}
                        </p>
                        <h3 className="text-3xl font-bold mt-2">
                          {stat.value}
                        </h3>
                      </div>

                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                        <Icon size={25} />
                      </div>
                    </div>

                    <p className="text-slate-500 text-sm">
                      {stat.subtitle}
                    </p>
                  </div>
                )
              })}

            </section>

            {mcqHistory.length === 0 && textHistory.length === 0 && (
              <div className="text-center bg-slate-900 border border-slate-800 rounded-2xl p-10 mt-6">
                <HistoryIcon size={40} className="mx-auto text-slate-500 mb-4" />
                <h3 className="text-xl font-semibold">No Test History Yet</h3>
                <p className="text-slate-400 mt-2">
                  Complete your first test to see your performance here.
                </p>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}

export default History
