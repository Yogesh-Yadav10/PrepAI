
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquareText,
  FileUser,
  History,
  FileSearch,
  Settings,
  LogOut,
  ArrowUpRight,
  Sparkles,
  UserRound,
  Sun,
  Moon,
  X,
} from 'lucide-react'

function Dashboard() {
  const navigate = useNavigate()

  // Get logged-in user details
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)

  // Saved theme
  const [theme, setTheme] = useState(
    localStorage.getItem('prepai_theme') || 'dark'
  )

  // Change global theme
  function changeTheme(selectedTheme) {
    setTheme(selectedTheme)
    localStorage.setItem('prepai_theme', selectedTheme)
    document.documentElement.setAttribute('data-theme', selectedTheme)
  }

  // Logout function
  function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  // Scroll to selected feature
  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  // Navigate to feature pages
  function handleFeatureClick(featureId) {
    if (featureId === 'mcq-test') {
      navigate('/mcq-test')
    } else if (featureId === 'text-test') {
      navigate('/text-test')
    } else if (featureId === 'resume-analysis') {
      navigate('/resume-analyzer')
    } else if (featureId === 'jd-analysis') {
      navigate('/jd-analyzer')
    }
  }

  // Dashboard features
  const features = [
    {
      id: 'mcq-test',
      title: 'MCQ Based Test',
      description:
        'Test your knowledge by selecting topics and attempting AI-powered MCQ questions.',
      icon: BrainCircuit,
      color: 'blue',
      tag: 'Topic Based',
    },
    {
      id: 'text-test',
      title: 'Text Based Test',
      description:
        'Choose your preferred role and practice answering interview questions.',
      icon: MessageSquareText,
      color: 'purple',
      tag: 'Role Based',
    },
    {
      id: 'resume-analysis',
      title: 'Resume Analysis',
      description:
        'Upload your resume and get AI-powered feedback and improvement suggestions.',
      icon: FileUser,
      color: 'emerald',
      tag: 'AI Analysis',
    },
    {
      id: 'jd-analysis',
      title: 'JD Analysis',
      description:
        'Analyze job descriptions and understand your skills and job requirements.',
      icon: FileSearch,
      color: 'amber',
      tag: 'AI Analysis',
    },
  ]

  // Feature colors
  const styles = {
    blue: {
      icon: 'bg-blue-500/10 text-blue-400',
      button: 'text-blue-400',
      glow: 'group-hover:border-blue-500/50',
    },
    purple: {
      icon: 'bg-purple-500/10 text-purple-400',
      button: 'text-purple-400',
      glow: 'group-hover:border-purple-500/50',
    },
    emerald: {
      icon: 'bg-emerald-500/10 text-emerald-400',
      button: 'text-emerald-400',
      glow: 'group-hover:border-emerald-500/50',
    },
    amber: {
      icon: 'bg-amber-500/10 text-amber-400',
      button: 'text-amber-400',
      glow: 'group-hover:border-amber-500/50',
    },
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex-col p-6">

        {/* Brand */}
        <h1 className="text-3xl font-bold tracking-wide mb-10">
          Prep<span className="text-blue-500">AI</span>
        </h1>

        {/* Workspace */}
        <p className="text-xs text-slate-500 font-semibold mb-4">
          WORKSPACE
        </p>

        <button
          onClick={() =>
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
          className="bg-blue-600/15 text-blue-400 rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-blue-600/25 transition"
        >
          <LayoutDashboard size={20} />
          <span className="font-medium">Dashboard</span>
        </button>

        {/* Features Section */}
        <p className="text-xs text-slate-500 font-semibold mt-9 mb-4">
          FEATURES
        </p>

        <nav className="space-y-2">

          <button
            onClick={() => scrollToSection('mcq-test')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
          >
            <BrainCircuit size={19} />
            MCQ Based Test
          </button>

          <button
            onClick={() => scrollToSection('text-test')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-slate-800 transition"
          >
            <MessageSquareText size={19} />
            Text Based Test
          </button>

          <button
            onClick={() => scrollToSection('resume-analysis')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
          >
            <FileUser size={19} />
            Resume Analysis
          </button>

          <button
            onClick={() => scrollToSection('jd-analysis')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
          >
            <FileSearch size={19} />
            JD Analysis
          </button>

        </nav>

        {/* History Section */}
        <p className="text-xs text-slate-500 font-semibold mt-9 mb-4">
          HISTORY
        </p>

        <button
          onClick={() => navigate('/history')}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
        >
          <History size={19} />
          Test History
        </button>

        {/* Sidebar Bottom */}
        <div className="mt-auto border-t border-slate-800 pt-5 space-y-5">

          {/* Settings */}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 text-slate-400 hover:text-white text-sm transition"
          >
            <Settings size={19} />
            Settings
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-red-400 hover:text-red-300 text-sm transition"
          >
            <LogOut size={19} />
            Logout
          </button>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">

        {/* Top Navbar */}
        <header
          id="dashboard-top"
          className="h-20 border-b border-slate-800 flex items-center justify-between px-5 sm:px-8 lg:px-10"
        >

          <div>
            <p className="text-slate-400 text-sm">
              PrepAI Workspace
            </p>

            <p className="text-white font-semibold">
              Dashboard
            </p>
          </div>

          {/* User Information */}
          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <UserRound size={21} />
            </div>

            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-white">
                {user.name || 'User'}
              </p>

              <p className="text-xs text-slate-500">
                {user.email || 'Your Account'}
              </p>
            </div>

          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto">

          {/* Animated Welcome Banner */}
          <section className="relative overflow-hidden rounded-2xl p-7 sm:p-10 mb-10 animate-fade-up">

            <div className="animated-banner-bg absolute inset-0"></div>

            <div className="glow-orb absolute -right-10 -top-20 w-72 h-72 bg-cyan-300/30 rounded-full blur-3xl z-10 pointer-events-none"></div>

            <div className="glow-orb-delayed absolute right-1/3 -bottom-32 w-64 h-64 bg-purple-400/30 rounded-full blur-3xl z-10 pointer-events-none"></div>

            <div className="relative z-20 max-w-2xl">

              <div className="flex items-center gap-2 text-blue-100 text-sm mb-4">
                <Sparkles size={17} />
                YOUR AI PREPARATION SPACE
              </div>

              <h2 className="text-2xl sm:text-4xl font-bold mb-4">
                Welcome back, {user.name?.split(' ')[0] || 'User'}!
              </h2>

              <p className="text-blue-100 text-sm sm:text-base leading-relaxed max-w-xl">
                Your interview preparation journey continues here.
                Practice smarter, analyze your resume and get ready
                for your next career opportunity.
              </p>

            </div>
          </section>

          {/* Feature Heading */}
          <section className="mb-6 animate-fade-up">
            <h2 className="text-2xl font-bold text-white">
              Explore Features
            </h2>

            <p className="text-slate-400 text-sm mt-2">
              Choose a feature to start your preparation.
            </p>
          </section>

          {/* Feature Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {features.map((feature, index) => {
              const Icon = feature.icon
              const style = styles[feature.color]

              // All implemented feature cards are clickable
              const isClickable = [
                'mcq-test',
                'text-test',
                'resume-analysis',
                'jd-analysis',
              ].includes(feature.id)

              return (
                <div
                  id={feature.id}
                  key={feature.id}
                  onClick={() => {
                    if (isClickable) {
                      handleFeatureClick(feature.id)
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      isClickable &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault()
                      handleFeatureClick(feature.id)
                    }
                  }}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  className={`feature-card-animated animate-fade-up group bg-slate-900 border border-slate-800 rounded-2xl p-6 scroll-mt-6 ${style.glow} ${
                    isClickable ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    animationDelay: `${index * 150}ms`,
                  }}
                >

                  {/* Icon and Tag */}
                  <div className="flex items-start justify-between mb-6">

                    <div className={`feature-icon-animated w-14 h-14 rounded-xl flex items-center justify-center ${style.icon}`}>
                      <Icon size={28} />
                    </div>

                    <span className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300">
                      {feature.tag}
                    </span>

                  </div>

                  {/* Feature Information */}
                  <h3 className="text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>

                  <p className="text-slate-400 text-sm leading-relaxed min-h-12">
                    {feature.description}
                  </p>

                  {/* Feature Action */}
                  <div className={`flex items-center gap-2 mt-6 text-sm font-semibold ${style.button}`}>
                    Explore Feature

                    <ArrowUpRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                    />
                  </div>

                </div>
              )
            })}

          </section>

          {/* Footer */}
          <footer className="border-t border-slate-800 mt-12 pt-6 text-center">
            <p className="text-slate-500 text-xs">
              © 2026 PrepAI. AI-Powered Interview Preparation Platform.
            </p>
          </footer>

        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">

          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">

            {/* Modal Header */}
            <div className="mb-6 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold text-white">
                  Settings
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Customize your PrepAI experience
                </p>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white transition"
                aria-label="Close settings"
              >
                <X size={22} />
              </button>

            </div>

            {/* Appearance */}
            <h3 className="mb-3 text-sm font-semibold text-white">
              Appearance
            </h3>

            <div className="grid grid-cols-2 gap-3">

              {/* Dark Mode */}
              <button
                onClick={() => changeTheme('dark')}
                className={`rounded-xl border p-4 text-left transition ${
                  theme === 'dark'
                    ? 'border-teal-400 bg-teal-400/10'
                    : 'border-slate-700 bg-slate-800'
                }`}
              >
                <Moon size={25} className="mb-3 text-teal-400" />

                <span className="font-semibold text-white block">
                  Dark Mode
                </span>

                <span className="mt-1 block text-xs text-slate-400">
                  Dark appearance
                </span>

                {theme === 'dark' && (
                  <span className="mt-3 block text-xs text-teal-400 font-semibold">
                    ✓ Active
                  </span>
                )}
              </button>

              {/* Light Mode */}
              <button
                onClick={() => changeTheme('light')}
                className={`rounded-xl border p-4 text-left transition ${
                  theme === 'light'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-700 bg-slate-800'
                }`}
              >
                <Sun size={25} className="mb-3 text-amber-400" />

                <span className="font-semibold text-white block">
                  Light Mode
                </span>

                <span className="mt-1 block text-xs text-slate-400">
                  Light appearance
                </span>

                {theme === 'light' && (
                  <span className="mt-3 block text-xs text-teal-400 font-semibold">
                    ✓ Active
                  </span>
                )}
              </button>

            </div>

            {/* Done Button */}
            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full rounded-xl bg-teal-400 py-3 font-semibold text-slate-950 hover:bg-teal-300 transition"
            >
              Done
            </button>

          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard
