import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../auth'
import { api } from '../api'
import type { CreateCredentialDto, Credential } from '../credenciais'

export function CredentialsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Credential[]>([])
  const [form, setForm] = useState<CreateCredentialDto>({
    name: '',
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState('')
  const currentUser = getCurrentUser()

  function handleUnauthorized() {
    logout()
    navigate('/login', { replace: true })
  }

  async function loadCredentials() {
    setLoadingList(true)
    setError('')
    try {
      const res = await api.get<Credential[]>('/credentials')
      setItems(res.data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError('Nao foi possivel carregar credenciais. Verifique se a API Nest esta rodando.')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    void loadCredentials()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/credentials', form)
      setForm({ name: '', username: '', password: '' })
      await loadCredentials()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError('Falha ao criar credencial. Confira os campos e a API.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      await api.delete(`/credentials/${id}`)
      await loadCredentials()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError('Falha ao excluir credencial.')
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const total = useMemo(() => items.length, [items])

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Painel</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Credenciais</h1>
            <p className="mt-2 text-sm text-slate-300">
              Cadastro local para estudo de consumo de API no front-end.
            </p>
            {currentUser ? (
              <p className="mt-1 text-xs text-slate-400">
                Logado como {currentUser.name} ({currentUser.email})
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/cash"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              Caixa
            </Link>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Total</p>
              <p className="text-lg font-semibold text-white">{total}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Nova credencial</h2>
            <p className="mt-1 text-sm text-slate-400">Envia POST /credentials para a sua API Nest.</p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm text-slate-200" htmlFor="name">
                  Nome
                </label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="Github"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-200" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="meu_usuario"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-200" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="123456"
                />
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Salvando...' : 'Criar credencial'}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Lista de credenciais</h2>
              <button
                type="button"
                onClick={() => void loadCredentials()}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Atualizar
              </button>
            </div>

            {loadingList ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-6 text-sm text-slate-300">
                Carregando credenciais...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/20 p-6 text-sm text-slate-400">
                Nenhuma credencial cadastrada ainda.
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">{item.name}</h3>
                        <p className="mt-1 text-sm text-slate-300">Usuario: {item.username}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Criado em {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
