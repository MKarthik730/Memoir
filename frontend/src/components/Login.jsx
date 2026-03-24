import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react'
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
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      backgroundColor: 'var(--color-parchment)'
    }}
    className="max-md:grid-cols-1"
    >
      {/* Left Panel - Hero */}
      <div style={{
        position: 'relative',
        padding: 'var(--space-xl)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
      className="max-md:hidden"
      >
        {/* Decorative Elements */}
        <div style={{
          position: 'absolute',
          top: '10%',
          right: '5%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--color-gold) 0%, transparent 70%)',
          opacity: 0.08
        }} />
        <div style={{
          position: 'absolute',
          bottom: '15%',
          left: '10%',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--color-sepia) 0%, transparent 70%)',
          opacity: 0.1
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: '1px solid var(--color-sepia)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-lg)',
            color: 'var(--color-ink-muted)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-ui)'
          }}>
            <Sparkles size={14} style={{ color: 'var(--color-gold)' }} />
            <span>Memory Preservation</span>
          </div>

          {/* Title */}
          <h1 className="hero-title" style={{
            fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
            fontStyle: 'italic',
            marginBottom: 'var(--space-md)',
            color: 'var(--color-ink)',
            maxWidth: '500px'
          }}>
            Every relationship has a story
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--color-ink-soft)',
            maxWidth: '400px',
            marginBottom: 'var(--space-xl)',
            lineHeight: 1.7
          }}>
            Remember yours. Capture the moments, preserve the connections, 
            and cherish the people who shape your life.
          </p>

          {/* Features */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-sm)'
          }}>
            {['Photos & Audio', 'Relationship Map', 'Memory Timeline'].map((feature) => (
              <div key={feature} style={{
                padding: '8px 14px',
                border: '1px solid var(--color-sepia)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-muted)'
              }}>
                {feature}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg)',
        backgroundColor: 'var(--color-cream)'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{
            width: '100%',
            maxWidth: '400px'
          }}
        >
          {/* Logo */}
          <div style={{
            textAlign: 'center',
            marginBottom: 'var(--space-lg)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto var(--space-md)',
              backgroundColor: 'var(--color-ink)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontStyle: 'italic',
                color: 'var(--color-parchment)'
              }}>
                M
              </span>
            </div>
            <h2 style={{
              fontSize: 'var(--text-xl)',
              marginBottom: '4px'
            }}>
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-muted)'
            }}>
              {isRegister 
                ? 'Begin your memory preservation journey' 
                : 'Continue preserving your memories'}
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-xs)',
            padding: '4px',
            backgroundColor: 'var(--color-dust)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-lg)'
          }}>
            <button
              onClick={() => setIsRegister(false)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: !isRegister ? 'var(--color-ink)' : 'transparent',
                color: !isRegister ? 'var(--color-parchment)' : 'var(--color-ink-muted)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: isRegister ? 'var(--color-ink)' : 'transparent',
                color: isRegister ? 'var(--color-parchment)' : 'var(--color-ink-muted)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)'
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  marginBottom: 'var(--space-md)',
                  backgroundColor: 'rgba(180, 60, 60, 0.1)',
                  border: '1px solid rgba(180, 60, 60, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#8B3A3A',
                  fontSize: 'var(--text-sm)'
                }}
              >
                {error}
              </motion.div>
            )}

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-soft)'
              }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-ink-muted)'
                }} />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Enter your username"
                  required
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 40px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--color-sepia)',
                    borderRadius: 0,
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)',
                    transition: 'border-color var(--duration-fast)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderBottomColor = 'var(--color-gold)'}
                  onBlur={(e) => e.target.style.borderBottomColor = 'var(--color-sepia)'}
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{
                display: 'block',
                marginBottom: 'var(--space-xs)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-soft)'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-ink-muted)'
                }} />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  minLength={isRegister ? 8 : 1}
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 40px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--color-sepia)',
                    borderRadius: 0,
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-base)',
                    transition: 'border-color var(--duration-fast)',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderBottomColor = 'var(--color-gold)'}
                  onBlur={(e) => e.target.style.borderBottomColor = 'var(--color-sepia)'}
                />
              </div>
              {isRegister && (
                <p style={{
                  marginTop: 'var(--space-xs)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-muted)'
                }}>
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px 28px',
                backgroundColor: 'var(--color-ink)',
                color: 'var(--color-parchment)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all var(--duration-base) var(--ease-out)',
                opacity: isLoading ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = 'var(--color-gold)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-ink)'
              }}
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

          <p style={{
            marginTop: 'var(--space-lg)',
            textAlign: 'center',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-muted)'
          }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-gold)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textDecoration: 'underline',
                textUnderlineOffset: '2px'
              }}
            >
              {isRegister ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
