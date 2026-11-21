
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react'

function Home() {
  return (
    <div className="relative min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 overflow-hidden">

      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>

      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>

      {/* Main Card Wrapper */}
      <div className="relative w-full max-w-3xl group">

        {/* Animated Card Outer Glow */}
        <div className="absolute -inset-1 rounded-[2rem] bg-linear-to-r from-blue-600 via-cyan-400 to-purple-600 blur-xl opacity-30 group-hover:opacity-60 transition duration-700"></div>

        {/* Main Card */}
        <div className="relative overflow-hidden bg-slate-900 border border-slate-700/80 rounded-[2rem] px-7 py-14 sm:px-12 sm:py-16 text-center shadow-2xl">

          {/* Inner Lighting Effects */}
          <div className="absolute -top-32 -left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="absolute -bottom-32 -right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Logo */}
          <div className="relative flex justify-center mb-7">

            <div className="relative w-24 h-24 rounded-3xl bg-linear-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30 transition duration-500 hover:scale-110 hover:rotate-3">

              <GraduationCap
                size={54}
                strokeWidth={1.7}
                className="text-white"
              />

              <Sparkles
                size={22}
                className="absolute -top-3 -right-3 text-cyan-300"
              />

            </div>
          </div>

          {/* Brand Name */}
          <h1 className="relative text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
            Prep<span className="bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
          </h1>

          {/* Tagline */}
          <div className="relative flex items-center justify-center gap-2 mt-4 mb-8">

            <p className="text-slate-400 text-xs sm:text-sm tracking-[0.2em] uppercase">
            </p>
          </div>

          {/* Welcome Text */}
          <h2 className="relative text-2xl sm:text-3xl font-bold text-white mb-4">
            Welcome to PrepAI
          </h2>

          <p className="relative text-slate-400 text-base sm:text-lg mb-10">
            Stop Scrolling. Start Preparing.
          </p>

          {/* Get Started */}
          <Link
            to="/login"
            className="relative inline-flex items-center justify-center gap-3
            bg-linear-to-r from-blue-600 to-indigo-600
          hover:from-blue-500 hover:to-purple-600
          text-white font-semibold px-10 py-4 rounded-xl
            transition-all duration-300
            hover:scale-105
            shadow-[0_0_12px_rgba(59,130,246,0.18)]
            hover:shadow-[0_0_18px_rgba(59,130,246,0.45),0_0_28px_rgba(139,92,246,0.2)]"
          >
            Get Started

            <ArrowRight
              size={20}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>


        </div>
      </div>
    </div>
  )
}

export default Home
