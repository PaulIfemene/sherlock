import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import { Button, ButtonLink } from '../../components/Button'
import { Logo } from '../../components/Navbar'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => data.session && navigate('/newsroom', { replace: true }))
  }, [navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/newsroom` } })
    if (error) {
      setState('error')
      setMessage(error.message)
    } else {
      setState('sent')
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between bg-primary p-8 text-white md:p-12">
        <Logo dark />
        <div className="my-12 max-w-md">
          <span className="pill-cap bg-gold text-ink">Newsroom</span>
          <h1 className="display-md mt-5 text-white">See what the public is asking about, before it spreads.</h1>
          <p className="mt-4 text-on-dark-mute">Rising claims, evidence gathered for you, and one click to send your verdict back to everyone who asked, in their language.</p>
        </div>
        <p className="text-[13px] text-on-dark-mute">Sender identities are never shown. Numbers are stored as keyed hashes.</p>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <h2 className="heading-lg">Sign in</h2>
          {!supabase ? (
            <>
              <p className="mt-2 text-ink-mute">Supabase is not configured on this build. You can open the dashboard with the fictional demo dataset instead.</p>
              <ButtonLink to="/newsroom" className="mt-6 w-full">
                Open offline demo
              </ButtonLink>
            </>
          ) : state === 'sent' ? (
            <div className="mt-4 rounded-[12px] bg-gold-cream p-4">
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1 text-[14px] text-ink-mute">We sent a sign-in link to {email}. Open it on this device.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6">
              <label htmlFor="email" className="field-label">
                Work email
              </label>
              <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@newsroom.example" />
              <Button type="submit" className="mt-4 w-full" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
              </Button>
              {state === 'error' && <p className="mt-3 text-[14px] text-error">{message}</p>}
              <p className="mt-4 text-[13px] text-ink-mute">Only invited journalists can open the dashboard.</p>
            </form>
          )}
          <p className="mt-8 text-[14px]">
            <Link to="/">Back to the public site</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
