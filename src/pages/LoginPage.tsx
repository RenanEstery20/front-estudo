import axios from 'axios'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../auth'

type AuthMode = 'login' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isRegister = mode === 'register'

  const helperText = useMemo(
    () =>
      isRegister
        ? 'Crie um usuario no backend (arquivo users.json) e depois faca login.'
        : 'Use o email/senha cadastrados no backend para receber o token JWT.',
    [isRegister],
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!email.trim() || !password.trim() || (isRegister && !name.trim())) {
      setError('Preencha os campos obrigatorios.')
      return
    }

    setLoading(true)

    try {
      if (isRegister) {
        await register({ name, email, password })
        setMessage('Cadastro realizado. Agora faca login para acessar as credenciais.')
        setMode('login')
        setPassword('')
        return
      }

      await login(email, password)
      navigate('/cash', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const apiMessage = err.response?.data?.message
        setError(Array.isArray(apiMessage) ? apiMessage.join(', ') : (apiMessage ?? 'Erro na autenticacao.'))
      } else {
        setError('Erro inesperado na autenticacao.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto grid min-h-[80vh] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
          <p className="mb-3 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200">
            Estudo Front + Nest
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Autenticacao com backend + JWT
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            O front envia cadastro e login para a API Nest. No login, o token JWT fica salvo no
            navegador e eh enviado automaticamente nas chamadas da API.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">API base</p>
              <p className="mt-1 text-sm text-slate-100 break-all">
                {String(import.meta.env.VITE_API_URL ?? '')}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rotas</p>
              <p className="mt-1 text-sm text-slate-100">POST /register | POST /login</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="mb-5 flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setMessage('')
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-cyan-300 text-slate-950'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError('')
                setMessage('')
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-cyan-300 text-slate-950'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Cadastro
            </button>
          </div>

          <h2 className="text-xl font-semibold text-white">
            {isRegister ? 'Criar conta' : 'Entrar'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{helperText}</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isRegister ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="name">
                  Nome
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="Seu nome"
                />
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="voce@email.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                placeholder="Minimo 6 caracteres"
              />
            </div>

            {message ? (
              <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? 'Processando...'
                : isRegister
                  ? 'Cadastrar no backend'
                  : 'Entrar no caixa'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
