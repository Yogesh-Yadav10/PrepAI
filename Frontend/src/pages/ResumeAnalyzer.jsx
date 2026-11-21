import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import {
  FileUser, ArrowLeft, UploadCloud, FileText, Trash2, Sparkles,
  CheckCircle2, AlertCircle, UserRound, Code, GraduationCap,
  BriefcaseBusiness, Award, Target, LoaderCircle, BrainCircuit,
  Lightbulb, RefreshCw, History, X, Eye,
} from 'lucide-react'

function getErrorMessage(err, fallback) {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(', ')
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return err.message || fallback
}

function ResumeAnalyzer() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [selectedFile, setSelectedFile] = useState(null)
  const [resumeId, setResumeId] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  // Load the logged-in user's resume history.
  async function fetchHistory() {
    try {
      setLoadingHistory(true)
      const response = await api.get('/resumes/history')
      setHistory(response.data.resumes || [])
    } catch (err) {
      console.error('Resume history error:', err)
      setError(getErrorMessage(err, 'Unable to load resume history.'))
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Validate PDF/DOCX file before uploading.
  function handleFileChange(file) {
    if (!file) return
    setError('')
    setSuccess('')

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    const validExtension = /\.(pdf|docx)$/i.test(file.name)

    if (!validExtension || !allowedTypes.includes(file.type)) {
      setSelectedFile(null)
      setError('Only valid PDF and DOCX files are allowed.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null)
      setError('File size must be less than 5 MB.')
      return
    }

    setSelectedFile(file)
    setResumeId(null)
    setAnalysis(null)
    setSuccess('Resume selected successfully!')
  }

  function handleInputChange(event) {
    handleFileChange(event.target.files?.[0])
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    if (!resumeId && !uploading && !analyzing) {
      handleFileChange(event.dataTransfer.files?.[0])
    }
  }

  // Upload the file once. Axios/browser creates the multipart boundary.
  async function uploadResume() {
    const formData = new FormData()
    formData.append('file', selectedFile)

    const response = await api.post('/resumes/upload', formData, {
      headers: { 'Content-Type': undefined },
    })

    if (!response.data?.resume_id) {
      throw new Error('The server did not return a resume ID after upload.')
    }
    return response.data.resume_id
  }

  // Upload first, then request AI analysis from FastAPI.
  async function handleAnalyze() {
    if (uploading || analyzing) return
    if (!selectedFile && !resumeId) {
      setError('Please select a resume first.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setAnalysis(null)

      let currentResumeId = resumeId

      if (!currentResumeId) {
        setUploading(true)
        currentResumeId = await uploadResume()
        setResumeId(currentResumeId)
        setUploading(false)
        setSuccess('Resume uploaded. Starting AI analysis...')
        await fetchHistory()
      }

      setAnalyzing(true)
      const response = await api.post(`/resumes/${currentResumeId}/analyze`)

      if (!response.data?.analysis) {
        throw new Error('The server did not return analysis data.')
      }

      setAnalysis(response.data.analysis)
      setSuccess('Resume analyzed successfully!')
      await fetchHistory()

      window.setTimeout(() => {
        document.getElementById('analysis-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    } catch (err) {
      console.error('Resume analysis error:', err)
      setError(getErrorMessage(err, 'Resume processing failed. Please try again.'))
      // If upload already succeeded, resumeId stays set.
      // Clicking Analyze again retries analysis without another upload.
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  // Open a previous resume from history.
  async function openResume(id) {
    try {
      setError('')
      setSuccess('')
      const response = await api.get(`/resumes/${id}`)
      const resume = response.data.resume

      setResumeId(resume.resume_id)
      setSelectedFile(null)
      setAnalysis(resume.analysis || null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      setSuccess(
        resume.analysis
          ? 'Previous resume analysis loaded.'
          : 'Resume loaded. Click Analyze Resume to analyze it.'
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Resume details error:', err)
      setError(getErrorMessage(err, 'Unable to open this resume.'))
    }
  }

  function confirmDelete(id) {
    if (!id) return
    setPendingDeleteId(id)
    setShowDeleteModal(true)
  }

  // Backend DELETE removes the database record and stored resume file.
  async function handleDelete() {
    const id = pendingDeleteId
    if (!id || deletingId) return

    try {
      setDeletingId(id)
      setError('')
      setSuccess('')
      const response = await api.delete(`/resumes/${id}`)

      setHistory((previous) => previous.filter((item) => item.resume_id !== id))

      if (resumeId === id) {
        setResumeId(null)
        setSelectedFile(null)
        setAnalysis(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }

      setSuccess(response.data?.message || 'Resume deleted successfully.')
    } catch (err) {
      console.error('Resume delete error:', err)
      setError(getErrorMessage(err, 'Unable to delete resume.'))
    } finally {
      setDeletingId(null)
      setShowDeleteModal(false)
      setPendingDeleteId(null)
    }
  }

  function resetCurrentResume() {
    setResumeId(null)
    setSelectedFile(null)
    setAnalysis(null)
    setError('')
    setSuccess('Select a new resume to get started.')
    if (fileInputRef.current) fileInputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function renderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return <p className="text-sm text-slate-500">No information available.</p>
    }

    return (
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm text-slate-300">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>{String(item)}</span>
          </li>
        ))}
      </ul>
    )
  }

  const insights = [
    { icon: UserRound, title: 'Profile Summary', description: 'Your professional identity at a glance.', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Code, title: 'Key Skills', description: 'Technical and professional skills.', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: GraduationCap, title: 'Education Insights', description: 'Your academic background.', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: BriefcaseBusiness, title: 'Experience Review', description: 'Your experience and achievements.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: Award, title: 'Strengths & Gaps', description: 'Areas to improve and build upon.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Target, title: 'Career Recommendations', description: 'Job roles matching your profile.', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <header className="border-b border-slate-800 px-5 sm:px-10 py-5">
        <div className="w-full flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Prep<span className="text-blue-500">AI</span>
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
              <ArrowLeft size={18} /> Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-12">
        {/* INTRO */}
        <div className="text-center mb-12 animate-fade-up">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5">
            <FileUser size={34} />
          </div>
          <p className="text-blue-400 text-sm font-semibold mb-3">AI POWERED RESUME ANALYSIS</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Resume Analyzer</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Upload your resume and get detailed AI-powered feedback on your skills,
            experience and career opportunities.
          </p>
        </div>

        {/* ERROR / SUCCESS */}
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="flex-1 break-words">{error}</span>
            <button onClick={() => setError('')} className="ml-auto"><X size={17} /></button>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle2 size={18} /> <span>{success}</span>
          </div>
        )}

        {/* UPLOAD + INSIGHTS */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 hover:border-blue-500/30 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileText size={23} />
              </div>
              <h3 className="text-xl font-semibold">Upload Your Resume</h3>
            </div>
            <p className="text-sm text-slate-400 mb-7">Select your resume to start AI-powered analysis.</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleInputChange}
              disabled={uploading || analyzing || !!resumeId}
              className="hidden"
            />

            <div
              onClick={() => {
                if (!resumeId && !uploading && !analyzing) fileInputRef.current?.click()
              }}
              onDragOver={(event) => {
                event.preventDefault()
                if (!resumeId && !uploading && !analyzing) setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-300 ${
                resumeId ? 'border-emerald-500/30 bg-emerald-500/5 cursor-not-allowed'
                  : isDragging ? 'border-blue-400 bg-blue-500/10 cursor-pointer'
                    : 'border-slate-700 hover:border-blue-500 hover:bg-blue-500/5 cursor-pointer'
              }`}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5">
                {resumeId ? <CheckCircle2 size={35} /> : <UploadCloud size={35} />}
              </div>
              <h4 className="text-lg font-semibold mb-2">
                {resumeId ? 'Resume Already Uploaded' : 'Drag your resume here or Browse'}
              </h4>
              <p className="text-sm text-slate-400">Supported formats: PDF and DOCX</p>
              <p className="text-xs text-slate-500 mt-2">Maximum file size: 5 MB</p>
            </div>

            {selectedFile && (
              <div className="mt-5 flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={25} className="text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button type="button" onClick={resetCurrentResume} disabled={uploading || analyzing} className="text-red-400 hover:text-red-300" title="Remove selected file">
                  <Trash2 size={19} />
                </button>
              </div>
            )}

            {resumeId && (
              <div className="mt-5 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm text-blue-300 font-semibold">Resume ID: {resumeId}</p>
                <p className="text-xs text-slate-400 mt-1">Resume saved in your account.</p>
              </div>
            )}

            <button
              type="button"
              disabled={(!selectedFile && !resumeId) || uploading || analyzing || !!analysis}
              onClick={handleAnalyze}
              className="w-full mt-8 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 transition-all duration-300"
            >
              {uploading ? <><LoaderCircle size={19} className="animate-spin" /> Uploading Resume...</>
                : analyzing ? <><LoaderCircle size={19} className="animate-spin" /> AI Analyzing Resume...</>
                  : analysis ? <><CheckCircle2 size={19} /> Analysis Completed</>
                    : <><Sparkles size={19} /> Analyze Resume</>}
            </button>

            {resumeId && (
              <button type="button" onClick={() => confirmDelete(resumeId)} disabled={uploading || analyzing || !!deletingId} className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 py-3 transition">
                <Trash2 size={18} /> Delete Resume & Analysis
              </button>
            )}
            {resumeId && !analysis && !analyzing && (
              <p className="text-xs text-slate-500 mt-3 text-center">
                If analysis did not complete, click Analyze Resume again to retry.
              </p>
            )}
          </div>

          {/* WHAT INSIGHTS YOU GET */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Sparkles size={23} />
              </div>
              <h3 className="text-lg font-bold">What Insights You'll Get</h3>
            </div>
            <p className="text-sm text-slate-400 mb-7">
              Discover your strengths, identify gaps and find new career opportunities.
            </p>
            <div className="space-y-5">
              {insights.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="flex items-center gap-3 group transition-all duration-300 hover:translate-x-1">
                    <div className={`w-10 h-10 shrink-0 rounded-xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* AI ANALYSIS RESULTS */}
        {analysis && (
          <section id="analysis-results" className="mt-14 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/10 border border-emerald-400/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/30">
                  <BrainCircuit size={25} />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] uppercase text-emerald-400 mb-1">
                    AI evaluation complete
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Your Resume Analysis
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    A closer look at your profile, skills and career readiness.
                  </p>
                </div>
              </div>
              <span className="w-fit inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <CheckCircle2 size={14} /> Analysis ready
              </span>
            </div>

            {/* SCORE CARD */}
            <div className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/50 p-6 sm:p-8 shadow-xl shadow-black/10">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="relative h-28 w-28 shrink-0 rounded-full bg-slate-950/70 p-2 ring-1 ring-blue-400/20">
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full border-[5px] border-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.16)]">
                    <span className="text-3xl font-extrabold tracking-tight text-blue-300">
                      {analysis.resume_score ?? '--'}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">OUT OF 100</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300 mb-2">
                    Resume performance
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    Resume Score
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    Your AI-generated resume quality score, based on the information and structure found in your uploaded resume.
                  </p>
                </div>
              </div>
            </div>

            {/* PROFILE SUMMARY */}
            <div className="group rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-7 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:shadow-blue-950/20">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-500/10 text-blue-300">
                  <UserRound size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">At a glance</p>
                  <h3 className="text-lg font-bold tracking-tight text-white">Profile Summary</h3>
                </div>
              </div>
              <p className="text-sm sm:text-[15px] leading-7 text-slate-300">
                {analysis.profile_summary || 'No summary available.'}
              </p>
            </div>

            {/* SKILLS, ROLES, STRENGTHS AND GAPS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-purple-400/15 bg-gradient-to-br from-slate-900 to-purple-950/20 p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/35">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
                    <Code size={20} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Key Skills</h3>
                </div>
                {renderItems(analysis.key_skills)}
              </div>

              <div className="rounded-2xl border border-pink-400/15 bg-gradient-to-br from-slate-900 to-pink-950/20 p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-pink-400/35">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300">
                    <Target size={20} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Recommended Job Roles</h3>
                </div>
                {renderItems(analysis.recommended_job_roles)}
              </div>

              <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/35">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                    <Award size={20} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Strengths</h3>
                </div>
                {renderItems(analysis.strengths)}
              </div>

              <div className="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-slate-900 to-amber-950/20 p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/35">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                    <Target size={20} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Areas for Improvement</h3>
                </div>
                {renderItems(analysis.areas_for_improvement)}
              </div>
            </div>

            {/* EDUCATION AND EXPERIENCE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-cyan-400/15 bg-slate-900 p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:border-cyan-400/30">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Education Summary</h3>
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  {analysis.education_summary || 'No education information available.'}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-400/15 bg-slate-900 p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:border-indigo-400/30">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Experience Summary</h3>
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  {analysis.experience_summary || 'No experience information available.'}
                </p>
              </div>
            </div>

            {/* IMPROVEMENT TIPS */}
            <div className="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-slate-900 to-amber-950/20 p-6 sm:p-7 shadow-lg shadow-black/10 transition-all duration-300 hover:border-amber-400/30">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                  <Lightbulb size={21} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Next steps</p>
                  <h3 className="text-lg font-bold tracking-tight text-white">Improvement Tips</h3>
                </div>
              </div>
              {renderItems(analysis.improvement_tips)}
            </div>

            {/* COMPACT NEW RESUME ACTION */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={resetCurrentResume}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-300 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400/50 hover:bg-blue-500/15 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              >
                <RefreshCw size={16} />
                Start with another resume
              </button>
            </div>
          </section>
        )}

        {/* RESUME HISTORY */}
        <section className="mt-14">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <History size={23} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Resume History</h2>
                <p className="text-xs text-slate-500">Your previously uploaded resumes.</p>
              </div>
            </div>
            <button onClick={fetchHistory} disabled={loadingHistory} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
              <RefreshCw size={16} className={loadingHistory ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="text-center py-10 text-slate-400">
              <LoaderCircle className="animate-spin mx-auto mb-3" /> Loading resume history...
            </div>
          ) : history.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
              <FileText size={35} className="mx-auto text-slate-600 mb-3" />
              <h3 className="font-semibold">No Resume History Yet</h3>
              <p className="text-sm text-slate-500 mt-2">Your uploaded resumes will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.resume_id} className={`bg-slate-900 border rounded-xl p-4 flex flex-wrap items-center gap-4 transition-all duration-300 ${resumeId === item.resume_id ? 'border-blue-500/50' : 'border-slate-800 hover:border-slate-600'}`}>
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                    <FileText size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.original_filename}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Resume ID: {item.resume_id} · {item.analysis_completed ? 'Analysis completed' : 'Not analyzed yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.analysis_completed && (
                      <span className="text-sm font-semibold text-emerald-400">{item.resume_score ?? '--'}/100</span>
                    )}
                    <button onClick={() => openResume(item.resume_id)} className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition" title="View resume">
                      <Eye size={19} />
                    </button>
                    <button onClick={() => confirmDelete(item.resume_id)} disabled={deletingId === item.resume_id} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition disabled:opacity-40" title="Delete resume">
                      {deletingId === item.resume_id ? <LoaderCircle size={19} className="animate-spin" /> : <Trash2 size={19} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CUSTOM DELETE MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl animate-fade-up">
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                  <Trash2 size={24} />
                </div>
                <button onClick={() => {
                  if (deletingId) return
                  setShowDeleteModal(false)
                  setPendingDeleteId(null)
                }} disabled={!!deletingId} className="text-slate-400 hover:text-white">
                  <X size={21} />
                </button>
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Resume?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Are you sure you want to permanently delete this resume and its AI analysis? This action cannot be undone.
              </p>
              <div className="flex gap-3 mt-7">
                <button onClick={() => {
                  setShowDeleteModal(false)
                  setPendingDeleteId(null)
                }} disabled={!!deletingId} className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={!!deletingId} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50">
                  {deletingId ? <><LoaderCircle size={17} className="animate-spin" /> Deleting...</> : <><Trash2 size={17} /> Delete</>}
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="border-t border-slate-800 mt-12 pt-6 text-center">
          <p className="text-xs text-slate-500">© 2026 PrepAI. AI-Powered Interview Preparation Platform.</p>
        </footer>
      </main>
    </div>
  )
}

export default ResumeAnalyzer
