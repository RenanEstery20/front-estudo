import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { getCurrentUser, logout } from '../auth'
import type { CashEntry, CashEntryType } from '../types/cash'

type TypeFilter = 'ALL' | CashEntryType

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatDateTimeBR(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}

function escapeCsv(value: string | number | undefined) {
  const text = String(value ?? '')
  if (!/[",;\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function formatDateInputBR(value: string) {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function paymentMethodLabel(value?: CashEntry['paymentMethod']) {
  if (value === 'CASH') return 'Dinheiro'
  if (value === 'CARD') return 'Cartao'
  if (value === 'PIX') return 'PIX'
  return '-'
}

export function ReportsPage() {
  const navigate = useNavigate()
  const currentUser = getCurrentUser()

  const [items, setItems] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  function handleUnauthorized() {
    logout()
    navigate('/login', { replace: true })
  }

  async function loadReport() {
    setLoading(true)
    setError('')

    try {
      const res = await api.get<CashEntry[]>('/cash-entries', {
        params: {
          ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(category.trim() ? { category: category.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(minAmount !== '' ? { minAmount } : {}),
          ...(maxAmount !== '' ? { maxAmount } : {}),
        },
      })

      setItems(res.data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized()
        return
      }

      const apiMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined
      setError(Array.isArray(apiMessage) ? apiMessage.join(', ') : 'Falha ao carregar relatorio.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [typeFilter, dateFrom, dateTo, category, description, minAmount, maxAmount])

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.type === 'IN') {
          acc.totalIn += item.amount
        } else {
          acc.totalOut += item.amount
        }
        return acc
      },
      { totalIn: 0, totalOut: 0 },
    )
  }, [items])

  const net = totals.totalIn - totals.totalOut
  const generatedAt = new Date()

  const filterSummary = [
    `Tipo: ${typeFilter === 'ALL' ? 'Todos' : typeFilter === 'IN' ? 'Entrada' : 'Saida'}`,
    `Data inicial: ${formatDateInputBR(dateFrom)}`,
    `Data final: ${formatDateInputBR(dateTo)}`,
    `Categoria: ${category.trim() || '-'}`,
    `Descricao: ${description.trim() || '-'}`,
    `Valor minimo: ${minAmount !== '' ? currency.format(Number(minAmount) || 0) : '-'}`,
    `Valor maximo: ${maxAmount !== '' ? currency.format(Number(maxAmount) || 0) : '-'}`,
  ]

  function clearFilters() {
    setTypeFilter('ALL')
    setDateFrom('')
    setDateTo('')
    setCategory('')
    setDescription('')
    setMinAmount('')
    setMaxAmount('')
  }

  function handlePrint() {
    window.print()
  }

  function handleDownloadCsv() {
    const header = ['Data/Hora', 'Tipo', 'Categoria', 'Descricao', 'Pagamento', 'Valor']
    const rows = items.map((item) => [
      formatDateTimeBR(item.createdAt),
      item.type === 'IN' ? 'Entrada' : 'Saida',
      item.category ?? '',
      item.description,
      item.paymentMethod ?? '',
      item.amount.toFixed(2).replace('.', ','),
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(';'))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-caixa-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className='reports-page min-h-screen px-4 py-8'>
      <div className='report-page-shell mx-auto max-w-7xl'>
        <div className='report-screen-only'>
        <header className='mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md'>
          <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <h1 className='text-2xl font-semibold text-white sm:text-3xl'>Relatorios</h1>
              <p className='mt-2 text-sm text-slate-300'>
                Monte relatorios com filtros continuos por tipo, periodo, categoria, descricao e valor.
              </p>
              {currentUser ? (
                <p className='mt-1 text-xs text-slate-400'>
                  {currentUser.name} ({currentUser.email}) • Empresa: {currentUser.company}
                </p>
              ) : null}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Link
                to='/cash'
                className='rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10'
              >
               Voltar
              </Link>
              <button
                type='button'
                onClick={handlePrint}
                className='rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10'
              >
                Imprimir
              </button>
              <button
                type='button'
                onClick={handlePrint}
                className='rounded-xl border border-white/10 bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200'
              >
                Gerar PDF
              </button>
              <button
                type='button'
                onClick={handleDownloadCsv}
                className='rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20'
              >
                Salvar CSV
              </button>
            </div>
          </div>
        </header>

        <section className='mb-6 rounded-3xl border border-white/10 bg-slate-950/65 p-6 backdrop-blur-xl'>
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            <div>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-type'>
                Tipo
              </label>
              <select
                id='report-type'
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60'
                style={{ colorScheme: 'dark' }}
              >
                <option value='ALL' className='bg-slate-900 text-white'>
                  Todos
                </option>
                <option value='IN' className='bg-slate-900 text-white'>
                  Entrada
                </option>
                <option value='OUT' className='bg-slate-900 text-white'>
                  Saida
                </option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-date-from'>
                Data inicial
              </label>
              <input
                id='report-date-from'
                type='date'
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-date-to'>
                Data final
              </label>
              <input
                id='report-date-to'
                type='date'
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-category'>
                Categoria
              </label>
              <input
                id='report-category'
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder='Ex: vendas'
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
              />
            </div>

            <div className='md:col-span-2'>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-description'>
                Descricao
              </label>
              <input
                id='report-description'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Buscar por trecho da descricao'
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-min-amount'>
                Valor minimo
              </label>
              <input
                id='report-min-amount'
                type='number'
                step='0.01'
                min='0'
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder='0,00'
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
              />
            </div>

            <div>
              <label className='mb-2 block text-sm text-slate-200' htmlFor='report-max-amount'>
                Valor maximo
              </label>
              <input
                id='report-max-amount'
                type='number'
                step='0.01'
                min='0'
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder='0,00'
                className='w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
              />
            </div>
          </div>

          <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
            <p className='text-xs text-slate-400'>
              Os filtros sao aplicados automaticamente. Para PDF, clique em "Gerar PDF" e escolha "Salvar como PDF".
            </p>
            <button
              type='button'
              onClick={clearFilters}
              className='rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10'
            >
              Limpar filtros
            </button>
          </div>
        </section>

        {error ? (
          <div className='mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
            {error}
          </div>
        ) : null}

        <section className='mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <article className='rounded-2xl border border-white/10 bg-slate-950/50 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Itens</p>
            <p className='mt-2 text-2xl font-semibold text-white'>{items.length}</p>
          </article>
          <article className='rounded-2xl border border-white/10 bg-slate-950/50 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Entradas</p>
            <p className='mt-2 text-2xl font-semibold text-emerald-300'>{currency.format(totals.totalIn)}</p>
          </article>
          <article className='rounded-2xl border border-white/10 bg-slate-950/50 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Saidas</p>
            <p className='mt-2 text-2xl font-semibold text-red-300'>{currency.format(totals.totalOut)}</p>
          </article>
          <article className='rounded-2xl border border-white/10 bg-slate-950/50 p-4'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Saldo filtrado</p>
            <p className={`mt-2 text-2xl font-semibold ${net >= 0 ? 'text-cyan-200' : 'text-red-300'}`}>
              {currency.format(net)}
            </p>
          </article>
        </section>

        <section className='rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-white'>Resultado do relatorio</h2>
            <button
              type='button'
              onClick={() => void loadReport()}
              className='rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10'
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className='rounded-2xl border border-white/10 bg-slate-950/30 p-6 text-sm text-slate-300'>
              Carregando relatorio...
            </div>
          ) : items.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-white/15 bg-slate-950/20 p-6 text-sm text-slate-400'>
              Nenhum lancamento encontrado com os filtros atuais.
            </div>
          ) : (
            <div className='space-y-3'>
              {items.map((item) => {
                const isIn = item.type === 'IN'

                return (
                  <article
                    key={item.id}
                    className='rounded-2xl border border-white/10 bg-slate-950/40 p-4'
                  >
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isIn ? 'bg-emerald-300/15 text-emerald-200' : 'bg-red-300/15 text-red-200'
                            }`}
                          >
                            {isIn ? 'Entrada' : 'Saida'}
                          </span>
                          {item.category ? (
                            <span className='rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300'>
                              {item.category}
                            </span>
                          ) : null}
                          {item.paymentMethod ? (
                            <span className='rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100'>
                              {item.paymentMethod === 'CASH'
                                ? 'Dinheiro'
                                : item.paymentMethod === 'CARD'
                                  ? 'Cartao'
                                  : 'PIX'}
                            </span>
                          ) : null}
                        </div>

                        <p className='mt-2 text-sm font-medium text-white'>{item.description}</p>
                        <p className='mt-1 text-xs text-slate-400'>{formatDateTimeBR(item.createdAt)}</p>
                      </div>

                      <p className={`text-base font-semibold ${isIn ? 'text-emerald-300' : 'text-red-300'}`}>
                        {isIn ? '+' : '-'} {currency.format(item.amount)}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        </div>

        <section className='report-print-only'>
          <div className='report-print-header'>
            <div>
              <h1>Relatorio de Caixa</h1>
              <p>Empresa: {currentUser?.company ?? '-'}</p>
              <p>Usuario: {currentUser?.name ?? '-'} ({currentUser?.email ?? '-'})</p>
            </div>
            <div className='report-print-meta'>
              <p>Emitido em: {generatedAt.toLocaleString('pt-BR')}</p>
              <p>Registros: {items.length}</p>
            </div>
          </div>

          <div className='report-print-filters'>
            {filterSummary.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <div className='report-print-summary'>
            <div>
              <span>Entradas</span>
              <strong>{currency.format(totals.totalIn)}</strong>
            </div>
            <div>
              <span>Saidas</span>
              <strong>{currency.format(totals.totalOut)}</strong>
            </div>
            <div>
              <span>Saldo filtrado</span>
              <strong>{currency.format(net)}</strong>
            </div>
          </div>

          <table className='report-print-table'>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Descricao</th>
                <th>Pagamento</th>
                <th className='is-right'>Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className='is-empty' colSpan={6}>
                    Nenhum lancamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTimeBR(item.createdAt)}</td>
                    <td>{item.type === 'IN' ? 'Entrada' : 'Saida'}</td>
                    <td>{item.category || '-'}</td>
                    <td>{item.description}</td>
                    <td>{paymentMethodLabel(item.paymentMethod)}</td>
                    <td className='is-right'>{currency.format(item.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className='is-right'>
                  Total de entradas
                </td>
                <td className='is-right'>{currency.format(totals.totalIn)}</td>
              </tr>
              <tr>
                <td colSpan={5} className='is-right'>
                  Total de saidas
                </td>
                <td className='is-right'>{currency.format(totals.totalOut)}</td>
              </tr>
              <tr>
                <td colSpan={5} className='is-right report-total-label'>
                  Saldo filtrado
                </td>
                <td className='is-right report-total-value'>{currency.format(net)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
    </main>
  )
}
