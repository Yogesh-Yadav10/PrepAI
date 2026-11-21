
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import {
  ArrowLeft, FileSearch, FileText, UploadCloud, Sparkles,
  CheckCircle2, AlertCircle, LoaderCircle, Target,
  BriefcaseBusiness, GraduationCap, Code2, Lightbulb,
  BookOpen, ShieldCheck, RefreshCw, XCircle, X,
} from 'lucide-react'

function getErrorMessage(err) {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(', ')
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return err.message || 'Something went wrong. Please try again.'
}

function ScoreCard({ title, score, description, icon: Icon }) {
  const validScore = typeof score === 'number'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">{title}</p>
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <Icon size={20} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">
        {validScore ? `${score.toFixed(1)}%` : 'N/A'}
      </p>
      <p className="text-xs text-slate-500 mt-2">{description}</p>
      {validScore && (
        <div className="w-full h-2 rounded-full bg-slate-800 mt-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      )}
    </div>
  )
}

function ListCard({ title, items, icon: Icon, color, emptyText }) {
  const colors = {
    green: 'text-emerald-400 bg-emerald-500/10',
    yellow: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>

      {items?.length ? (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
              <span className="text-slate-500 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{emptyText || 'No items available.'}</p>
      )}
    </div>
  )
}

function InfoCard({ title, value, description, icon: Icon }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
          <Icon size={20} />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm font-medium text-white leading-relaxed">{value || 'Not clearly mentioned'}</p>
      {description && (
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">{description}</p>
      )}
    </div>
  )
}

function JDAnalyzer() {
  const navigate = useNavigate()
  const jdInputRef = useRef(null)
  const resumeInputRef = useRef(null)

  const [jdMode, setJdMode] = useState('text')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState(null)

  const [resumeMode, setResumeMode] = useState('existing')
  const [resumeId, setResumeId] = useState('')
  const [resumeFile, setResumeFile] = useState(null)

  const [analysis, setAnalysis] = useState(null)
  const [resumeInfo, setResumeInfo] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function validateFile(file, type) {
    if (!file) return false

    const extension = file.name.split('.').pop()?.toLowerCase()
    const allowed = type === 'jd'
      ? ['pdf', 'docx', 'txt']
      : ['pdf', 'docx']

    if (!allowed.includes(extension)) {
      setError(
        type === 'jd'
          ? 'JD file must be PDF, DOCX or TXT.'
          : 'Resume file must be PDF or DOCX.'
      )
      return false
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must not exceed 5 MB.')
      return false
    }

    return true
  }

  function handleJDFile(file) {
    setError('')
    setSuccess('')
    setAnalysis(null)

    if (!validateFile(file, 'jd')) {
      setJdFile(null)
      return
    }

    setJdFile(file)
    setSuccess('Job Description selected successfully.')
  }

  function handleResumeFile(file) {
    setError('')
    setSuccess('')
    setAnalysis(null)

    if (!validateFile(file, 'resume')) {
      setResumeFile(null)
      return
    }

    setResumeFile(file)
    setSuccess('Resume selected successfully.')
  }

  async function handleEvaluate(event) {
    event.preventDefault()

    if (analyzing) return

    if (jdMode === 'text' && !jdText.trim()) {
      setError('Please paste the Job Description text.')
      return
    }

    if (jdMode === 'file' && !jdFile) {
      setError('Please upload a JD file.')
      return
    }

    if (resumeMode === 'existing' && !resumeId.trim()) {
      setError('Please enter your existing Resume ID.')
      return
    }

    if (resumeMode === 'new' && !resumeFile) {
      setError('Please upload a new resume.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setAnalysis(null)
      setResumeInfo(null)
      setAnalyzing(true)

      const formData = new FormData()

      if (jdMode === 'text') {
        formData.append('jd_text', jdText.trim())
      } else {
        formData.append('jd_file', jdFile)
      }

      if (resumeMode === 'existing') {
        formData.append('resume_id', resumeId.trim())
      } else {
        formData.append('resume_file', resumeFile)
      }

      const response = await api.post('/jd-analysis/evaluate', formData, {
        headers: { 'Content-Type': undefined },
      })

      if (!response.data?.analysis) {
        throw new Error('The server did not return evaluation data.')
      }

      setAnalysis(response.data.analysis)
      setResumeInfo({
        source: response.data.resume_source,
        id: response.data.resume_id,
        filename: response.data.resume_filename,
        jdFilename: response.data.jd_filename,
      })
      setSuccess('JD evaluation completed successfully.')

      window.setTimeout(() => {
        document.getElementById('jd-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    } catch (err) {
      console.error('JD evaluation error:', err)
      setError(getErrorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  function resetForm() {
    setJdMode('text')
    setJdText('')
    setJdFile(null)
    setResumeMode('existing')
    setResumeId('')
    setResumeFile(null)
    setAnalysis(null)
    setResumeInfo(null)
    setError('')
    setSuccess('')
    if (jdInputRef.current) jdInputRef.current.value = ''
    if (resumeInputRef.current) resumeInputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const score = analysis?.match_score
  const experienceStatus = analysis?.experience_status
  const educationStatus = analysis?.education_eligibility

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="w-full px-5 sm:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileSearch className="text-blue-400" size={20} />
            <span>PrepAI</span>
            <span className="text-blue-400">JD Analyzer</span>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-400 hover:text-blue-300 transition"
          >
            <ArrowLeft size={19} />
            <span className="text-sm">Dashboard</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-9">
        <section className="mb-8">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-3">
            <FileSearch size={17} />
            JD ANALYZER
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Resume vs Job Description
          </h1>
          <p className="text-slate-400 mt-3 max-w-2xl leading-relaxed">
            Compare your resume with a job description to understand your skill
            match, experience, education eligibility and areas to improve.
          </p>
        </section>

        <form onSubmit={handleEvaluate} className="space-y-6">
          {/* JOB DESCRIPTION */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <FileSearch size={23} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Job Description</h2>
                <p className="text-xs text-slate-500">Upload a JD file or paste its text.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <button
                type="button"
                onClick={() => {
                  setJdMode('text')
                  setJdFile(null)
                  setError('')
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  jdMode === 'text'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Paste JD Text
              </button>
              <button
                type="button"
                onClick={() => {
                  setJdMode('file')
                  setJdText('')
                  setError('')
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  jdMode === 'file'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Upload JD File
              </button>
            </div>

            {jdMode === 'text' ? (
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={8}
                placeholder="Paste the complete job description here..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500 resize-y"
              />
            ) : (
              <div
                onClick={() => jdInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-8 text-center cursor-pointer transition"
              >
                <input
                  ref={jdInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => handleJDFile(e.target.files?.[0])}
                />
                <UploadCloud size={32} className="mx-auto text-amber-400 mb-3" />
                <p className="font-semibold text-white">Click to upload Job Description</p>
                <p className="text-xs text-slate-500 mt-2">PDF, DOCX or TXT · Maximum 5 MB</p>
                {jdFile && (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400">
                    <FileText size={17} />
                    {jdFile.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setJdFile(null)
                        if (jdInputRef.current) jdInputRef.current.value = ''
                      }}
                      className="ml-1 text-slate-400 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* RESUME SOURCE */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileText size={23} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Your Resume</h2>
                <p className="text-xs text-slate-500">Choose how you want to provide your resume.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => {
                  setResumeMode('existing')
                  setResumeFile(null)
                  setError('')
                }}
                className={`text-left p-4 rounded-xl border transition ${
                  resumeMode === 'existing'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={18} className={resumeMode === 'existing' ? 'text-blue-400' : 'text-slate-500'} />
                  <span className="font-semibold text-sm">I have a Resume ID</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Use a resume already uploaded in Resume Analyzer.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResumeMode('new')
                  setResumeId('')
                  setError('')
                }}
                className={`text-left p-4 rounded-xl border transition ${
                  resumeMode === 'new'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <UploadCloud size={18} className={resumeMode === 'new' ? 'text-blue-400' : 'text-slate-500'} />
                  <span className="font-semibold text-sm">Upload a New Resume</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Use a resume for this evaluation without saving it to history.
                </p>
              </button>
            </div>

            {resumeMode === 'existing' ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Enter your Resume ID
                </label>
                <input
                  type="number"
                  min="1"
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-full sm:max-w-sm bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-2">
                  You can find your Resume ID in Resume Analyzer → Resume History.
                </p>
              </div>
            ) : (
              <div
                onClick={() => resumeInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-8 text-center cursor-pointer transition"
              >
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => handleResumeFile(e.target.files?.[0])}
                />
                <UploadCloud size={32} className="mx-auto text-blue-400 mb-3" />
                <p className="font-semibold text-white">Click to upload your resume</p>
                <p className="text-xs text-slate-500 mt-2">PDF or DOCX · Maximum 5 MB</p>
                {resumeFile && (
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400">
                    <FileText size={17} />
                    {resumeFile.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setResumeFile(null)
                        if (resumeInputRef.current) resumeInputRef.current.value = ''
                      }}
                      className="ml-1 text-slate-400 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <AlertCircle size={19} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {success && !analysis && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              <CheckCircle2 size={18} />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-4 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <LoaderCircle size={20} className="animate-spin" />
                Evaluating Resume...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Evaluate Resume Against JD
              </>
            )}
          </button>
        </form>

        {/* EVALUATION RESULTS */}
        {analysis && (
          <section id="jd-results" className="mt-14 space-y-7 scroll-mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
                  <CheckCircle2 size={17} />
                  EVALUATION COMPLETED
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">Your Evaluation Report</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Resume: {resumeInfo?.filename || 'Uploaded resume'}
                  {resumeInfo?.id ? ` · Resume ID: ${resumeInfo.id}` : ' · Temporary upload'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="group flex items-center gap-2 rounded-xl border border-blue-400/30 bg-gradient-to-r from-blue-600/20 to-cyan-500/10 px-5 py-3 text-sm font-semibold text-blue-200 shadow-lg shadow-blue-950/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400/60 hover:from-blue-600/30 hover:to-cyan-500/20 hover:text-white hover:shadow-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              >
                <RefreshCw size={16} className="transition-transform duration-300 group-hover:rotate-[-45deg]" />
                New Evaluation
              </button>
            </div>

            {/* OVERALL SCORE */}
            <div className="bg-gradient-to-br from-blue-600/20 via-slate-900 to-purple-600/10 border border-blue-500/30 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-blue-300 font-semibold mb-2">OVERALL JD MATCH SCORE</p>
                  <p className="text-5xl sm:text-6xl font-bold text-white">
                    {typeof score === 'number' ? `${score.toFixed(1)}%` : 'N/A'}
                  </p>
                  <p className="text-sm text-slate-400 mt-3 max-w-xl">
                    This score estimates how closely the provided resume matches the job description.
                  </p>
                </div>
                <div className="w-28 h-28 rounded-full border-8 border-blue-500/30 flex items-center justify-center">
                  <Target size={43} className="text-blue-400" />
                </div>
              </div>
            </div>

            {/* SCORE BREAKDOWN */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <ScoreCard title="Skills Match" score={analysis.skills_match_score} description="Required skills found in resume" icon={Code2} />
              <ScoreCard title="Experience Match" score={analysis.experience_match_score} description="Professional experience alignment" icon={BriefcaseBusiness} />
              <ScoreCard title="Education Match" score={analysis.education_match_score} description="Education requirement alignment" icon={GraduationCap} />
              <ScoreCard title="Responsibilities" score={analysis.responsibility_match_score} description="Role responsibility alignment" icon={Target} />
            </div>

            {/* SKILLS */}
            <div>
              <h3 className="text-xl font-bold mb-4">Skills Comparison</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <ListCard title="Matched Skills" items={analysis.matched_skills} icon={CheckCircle2} color="green" />
                <ListCard title="Partially Matched" items={analysis.partially_matched_skills} icon={AlertCircle} color="yellow" />
                <ListCard title="Missing Skills" items={analysis.missing_skills} icon={XCircle} color="red" emptyText="No missing skills identified." />
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Missing skills means they were not identified in the resume; it does not necessarily mean you do not possess them.
              </p>
            </div>

            {/* EXPERIENCE AND EDUCATION */}
            <div>
              <h3 className="text-xl font-bold mb-4">Experience & Education</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoCard
                  title="Experience Analysis"
                  value={`Required: ${analysis.experience_required || 'Not specified'} · Found: ${analysis.experience_found || 'Not clearly mentioned'}`}
                  description={`${analysis.experience_analysis || ''}${analysis.experience_gap ? `\n\nGap: ${analysis.experience_gap}` : ''}`}
                  icon={BriefcaseBusiness}
                />
                <InfoCard
                  title="Education Analysis"
                  value={`Required: ${analysis.education_requirement || 'Not specified'} · Found: ${analysis.education_found || 'Not clearly mentioned'}`}
                  description={`${analysis.education_analysis || ''}${educationStatus ? `\n\nEligibility: ${educationStatus}` : ''}`}
                  icon={GraduationCap}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Experience Status</p>
                  <p className="font-semibold text-white capitalize">
                    {(experienceStatus || 'Not available').replaceAll('_', ' ')}
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Education Eligibility</p>
                  <p className="font-semibold text-white">{educationStatus || 'Unclear'}</p>
                </div>
              </div>
            </div>

            {/* REQUIREMENTS */}
            <div>
              <h3 className="text-xl font-bold mb-4">Job Requirements</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <ListCard title="Matched Requirements" items={analysis.matched_requirements} icon={CheckCircle2} color="green" />
                <ListCard title="Missing Requirements" items={analysis.missing_requirements} icon={XCircle} color="red" />
              </div>
            </div>

            {/* RECOMMENDATIONS */}
            <div>
              <h3 className="text-xl font-bold mb-4">Your Improvement Plan</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <ListCard title="Skills to Learn" items={analysis.skills_to_learn} icon={BookOpen} color="purple" />
                <ListCard title="Resume Improvement Suggestions" items={analysis.resume_improvement_suggestions} icon={Lightbulb} color="blue" />
              </div>
            </div>

            {/* FINAL SUMMARY */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={23} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Overall Suitability</h3>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {analysis.suitability_summary || 'No suitability summary available.'}
              </p>
            </div>

            <p className="text-xs text-slate-500 text-center">
              AI-generated guidance only. Verify job requirements and eligibility with the employer.
            </p>
          </section>
        )}

        <footer className="border-t border-slate-800 mt-14 pt-6 text-center">
          <p className="text-xs text-slate-500">
            © 2026 PrepAI. AI-Powered Interview Preparation Platform.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default JDAnalyzer
