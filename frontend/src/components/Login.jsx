import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { cn, postJSON } from '../lib/utils'

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: ''
  })
  const [focusedField, setFocusedField] = useState(null)
  const [hoverButton, setHoverButton] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const endpoint = isRegister ? '/sign_up' : '/login'
      const body = isRegister
        ? { name: form.username, password: form.password }
        : { name: form.username, password: form.password }

      const data = await postJSON(endpoint, body)

      localStorage.setItem('memoir_token', data.access_token)
      localStorage.setItem('memoir_user', data.username || form.username)
      localStorage.setItem('memoir_user_id', data.user_id)
      
      onLogin()
    } catch (err) {
      setError(err.detail || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-2 bg-parchment max-md:grid-cols-1">
      <div className="relative p-16 flex flex-col justify-center overflow-hidden max-md:hidden">
        <div className="absolute top-[10%] right-[5%] w-[300px] h-[300px] rounded-full bg-radial from-gold to-transparent opacity-[0.08]" />
        <div className="absolute bottom-[15%] left-[10%] w-[200px] h-[200px] rounded-full bg-radial from-sepia to-transparent opacity-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 border border-sepia rounded-md mb-8 text-ink-muted text-xs font-ui tracking-widest uppercase">
            <Sparkles size={14} className="text-gold" />
            <span>Memory Preservation</span>
          </div>

          <h1 className="hero-title font-display italic text-[clamp(2.5rem,4vw,3.5rem)] mb-4 text-ink max-w-[500px]">
            Every relationship has a story
          </h1>

          <p className="text-lg text-ink-soft max-w-[400px] mb-16 leading-relaxed">
            Remember yours. Capture the moments, preserve the connections, 
            and cherish the people who shape your life.
          </p>

          <div className="flex flex-wrap gap-2">
            {['Photos & Audio', 'Relationship Map', 'Memory Timeline'].map((feature) => (
              <div key={feature} className="px-3 py-2 border border-sepia rounded-sm text-xs font-ui tracking-widest uppercase text-ink-muted">
                {feature}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex items-center justify-center p-8 bg-cream">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="w-full max-w-[400px]"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 bg-ink rounded-md flex items-center justify-center">
              <span className="font-display italic text-[28px] text-parchment">M</span>
            </div>
            <h2 className="font-display italic text-xl mb-1">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-ink-muted">
              {isRegister 
                ? 'Begin your memory preservation journey' 
                : 'Continue preserving your memories'}
            </p>
          </div>

          <div className="flex gap-1 p-1 bg-dust rounded-md mb-8">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 px-3 py-3 rounded-sm border-none font-ui text-xs tracking-widest uppercase cursor-pointer transition-all duration-150 ${!isRegister ? 'bg-ink text-parchment' : 'bg-transparent text-ink-muted'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 px-3 py-3 rounded-sm border-none font-ui text-xs tracking-widest uppercase cursor-pointer transition-all duration-150 ${isRegister ? 'bg-ink text-parchment' : 'bg-transparent text-ink-muted'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 mb-4 bg-[rgba(180,60,60,0.1)] border border-[rgba(180,60,60,0.3)] rounded-sm text-[#8B3A3A] text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="mb-4">
              <label className="block mb-1 text-xs font-ui tracking-widest uppercase text-ink-soft">
                Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your username"
                  required
                  className={`w-full pl-10 pr-0 py-3 bg-transparent border-b ${focusedField === 'username' ? 'border-gold' : 'border-sepia'} text-ink font-body text-base outline-none transition-colors duration-150`}
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="block mb-1 text-xs font-ui tracking-widest uppercase text-ink-soft">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  required
                  minLength={isRegister ? 8 : 1}
                  className={`w-full pl-10 pr-0 py-3 bg-transparent border-b ${focusedField === 'password' ? 'border-gold' : 'border-sepia'} text-ink font-body text-base outline-none transition-colors duration-150`}
                />
              </div>
              {isRegister && (
                <p className="mt-1 text-xs text-ink-muted">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => setHoverButton(true)}
              onMouseLeave={() => setHoverButton(false)}
              className={`w-full px-6 py-3 ${hoverButton && !isLoading ? 'bg-gold' : 'bg-ink'} text-parchment border-none rounded-sm font-ui text-xs tracking-widest uppercase cursor-wait flex items-center justify-center gap-2 transition-all duration-300`}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-muted">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="bg-none border-none text-gold cursor-pointer font-inherit text-inherit underline underline-offset-2"
            >
              {isRegister ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
