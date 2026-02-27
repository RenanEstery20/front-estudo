import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../auth";
import { api } from "../api";
import type {
  CashEntry,
  CashEntryType,
  CashPaymentMethod,
  CreateCashEntryDto,
  DailyCashSummary,
  ReceiptScanResult,
} from "../types/cash";

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Falha ao ler imagem."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao carregar imagem."));
    image.src = dataUrl;
  });
}

async function fileToOptimizedDataUrl(file: File) {
  const original = await fileToDataUrl(file);
  const image = await dataUrlToImage(original);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Falha ao preparar imagem.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function isLikelyImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  const lowerName = file.name.toLowerCase();
  return /\.(png|jpe?g|webp|bmp|gif|heic|heif)$/i.test(lowerName);
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDateBR(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function extractApiMessage(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message.trim()) return message;
  return undefined;
}

export function CashPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [summary, setSummary] = useState<DailyCashSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayDateInput);
  const [typeFilter, setTypeFilter] = useState<"ALL" | CashEntryType>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | CashPaymentMethod>(
    "ALL",
  );
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [ocrInfo, setOcrInfo] = useState("");
  const [error, setError] = useState("");
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateCashEntryDto>({
    type: "IN",
    paymentMethod: "PIX",
    amount: 0,
    description: "",
    category: "",
    entryDate: todayDateInput(),
  });

  function handleUnauthorized() {
    logout();
    navigate("/login", { replace: true });
  }

  async function loadDashboard() {
    setLoadingDashboard(true);
    setError("");

    try {
      const [entriesRes, summaryRes] = await Promise.all([
        api.get<CashEntry[]>("/cash-entries", {
          params: {
            date: selectedDate,
            ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
            ...(paymentFilter !== "ALL"
              ? { paymentMethod: paymentFilter }
              : {}),
          },
        }),
        api.get<DailyCashSummary>("/cash-summary/daily", {
          params: { date: selectedDate },
        }),
      ]);

      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setError(
        "Nao foi possivel carregar os dados do caixa. Verifique se o backend esta rodando.",
      );
    } finally {
      setLoadingDashboard(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [selectedDate, typeFilter, paymentFilter]);

  async function handleCreateEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!form.description.trim()) {
      setError("Informe uma descricao para o lancamento.");
      return;
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/cash-entries", {
        ...form,
        amount: Number(form.amount),
        category: form.category?.trim() || undefined,
        description: form.description.trim(),
      });

      setForm((prev) => ({
        ...prev,
        amount: 0,
        description: "",
        category: "",
        entryDate: prev.entryDate ?? selectedDate,
      }));

      await loadDashboard();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
        return;
      }

      setError(
        extractApiMessage(err) ?? "Falha ao criar lancamento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(id: string) {
    setError("");
    try {
      await api.delete(`/cash-entries/${id}`);
      await loadDashboard();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setError("Falha ao excluir lancamento.");
    }
  }

  async function handleScanReceiptFile(file: File) {
    setError("");
    setOcrInfo("");
    setScanningReceipt(true);

    try {
      if (!isLikelyImageFile(file)) {
        setError("Arquivo invalido. Envie uma imagem.");
        return;
      }

      const base64Image = await fileToOptimizedDataUrl(file);
      if (!base64Image.startsWith("data:image/")) {
        setError("Arquivo invalido. Envie uma imagem.");
        return;
      }

      if (base64Image.length > 9_500_000) {
        setError("Imagem muito grande. Tire a foto mais de perto ou com menor resolucao.");
        return;
      }

      const res = await api.post<ReceiptScanResult>("/cash-entries/scan-receipt", {
        base64Image,
        language: "por",
      });
      const parsed = res.data;

      setForm((prev) => ({
        ...prev,
        type: parsed.type ?? prev.type,
        paymentMethod: parsed.paymentMethod ?? prev.paymentMethod,
        amount: parsed.amount ?? prev.amount,
        description: parsed.description ?? prev.description,
        category: parsed.category ?? prev.category,
        entryDate: parsed.entryDate ?? prev.entryDate,
      }));

      if (parsed.entryDate) {
        setSelectedDate(parsed.entryDate);
      }

      const confidencePercent = Math.round((parsed.confidence ?? 0) * 100);
      setOcrInfo(
        `Leitura concluida (${confidencePercent}% de confianca). Confira os campos antes de salvar.`,
      );
    } catch (err) {
      setError(
        extractApiMessage(err) ??
          "Falha ao ler comprovante. Tente novamente com uma foto mais nitida.",
      );
    } finally {
      setScanningReceipt(false);
      if (receiptInputRef.current) {
        receiptInputRef.current.value = "";
      }
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const balanceTone =
    (summary?.balance ?? 0) > 0
      ? "text-emerald-300"
      : (summary?.balance ?? 0) < 0
        ? "text-red-300"
        : "text-slate-100";

  const filteredCount = useMemo(() => entries.length, [entries]);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                Controle de Caixa
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Registre entradas e saidas e acompanhe o resumo do dia em tempo
                real.
              </p>
              {currentUser ? (
                <p className="mt-1 text-xs text-slate-400">
                  Logado como {currentUser.name} ({currentUser.email})
                </p>
              ) : null}
              {currentUser?.company ? (
                <p className="mt-1 text-xs text-cyan-200/80">
                  Empresa: {currentUser.company}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/reports"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Relatorios
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Entradas (dia)
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">
              {currency.format(summary?.totalIn ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {summary?.countIn ?? 0} lancamentos
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Saidas (dia)
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-300">
              {currency.format(summary?.totalOut ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {summary?.countOut ?? 0} lancamentos
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Saldo (dia)
            </p>
            <p className={`mt-2 text-2xl font-semibold ${balanceTone}`}>
              {currency.format(summary?.balance ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Data {formatDateBR(summary?.date ?? selectedDate)}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Itens listados
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {filteredCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Filtro: {typeFilter === "ALL" ? "Todos" : typeFilter}
            </p>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">
              Novo lancamento
            </h2>

            <form className="mt-5 space-y-4" onSubmit={handleCreateEntry}>
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3">
                <p className="text-sm font-medium text-cyan-100">
                  Leitura de comprovante por foto (mobile)
                </p>
                <p className="mt-1 text-xs text-cyan-100/80">
                  Tire a foto do papel e preencha automaticamente os campos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={scanningReceipt}
                    className="rounded-lg border border-cyan-100/30 bg-cyan-200/80 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {scanningReceipt ? "Lendo foto..." : "Tirar foto / Selecionar imagem"}
                  </button>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void handleScanReceiptFile(file);
                    }}
                  />
                </div>
                {ocrInfo ? (
                  <p className="mt-2 text-xs text-cyan-100">{ocrInfo}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: "IN" }))}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    form.type === "IN"
                      ? "border-emerald-300/60 bg-emerald-300/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: "OUT" }))}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    form.type === "OUT"
                      ? "border-red-300/60 bg-red-300/20 text-red-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Saida
                </button>
              </div>

              <div>
                <label
                  htmlFor="entryDate"
                  className="mb-2 block text-sm text-slate-200"
                >
                  Data do lancamento
                </label>
                <input
                  id="entryDate"
                  type="date"
                  value={form.entryDate ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, entryDate: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
                />
              </div>

              <div>
                <label
                  htmlFor="paymentMethod"
                  className="mb-2 block text-sm text-slate-200"
                >
                  Forma de pagamento
                </label>
                <select
                  id="paymentMethod"
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value as CashPaymentMethod,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="PIX" className="bg-slate-900 text-white">
                    PIX
                  </option>
                  <option value="CASH" className="bg-slate-900 text-white">
                    Dinheiro
                  </option>
                  <option value="CARD" className="bg-slate-900 text-white">
                    Cartao
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="amount"
                  className="mb-2 block text-sm text-slate-200"
                >
                  Valor
                </label>
                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      amount: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm text-slate-200"
                >
                  Descricao
                </label>
                <input
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="Ex: venda no pix / pagamento fornecedor"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-2 block text-sm text-slate-200"
                >
                  Categoria (opcional)
                </label>
                <input
                  id="category"
                  value={form.category ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="Vendas, Aluguel, Fornecedor..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Salvando..." : "Registrar lancamento"}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-2.5">
              <h2 className="text-lg font-semibold text-white">
                Movimentações do dia {formatDateBR(summary?.date ?? selectedDate)}
              </h2>
            </div>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[180px_140px_160px_auto]">
                <div>
                  <label
                    htmlFor="filter-date"
                    className="mb-1 block text-xs text-slate-400"
                  >
                    Data
                  </label>
                  <input
                    id="filter-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        entryDate: e.target.value,
                      }));
                    }}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="filter-type"
                    className="mb-1 block text-xs text-slate-400"
                  >
                    Tipo
                  </label>
                  <select
                    id="filter-type"
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as "ALL" | CashEntryType)
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="ALL" className="bg-slate-900 text-white">
                      Todos
                    </option>
                    <option value="IN" className="bg-slate-900 text-white">
                      Entradas
                    </option>
                    <option value="OUT" className="bg-slate-900 text-white">
                      Saidas
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-payment"
                    className="mb-1 block text-xs text-slate-400"
                  >
                    Pagamento
                  </label>
                  <select
                    id="filter-payment"
                    value={paymentFilter}
                    onChange={(e) =>
                      setPaymentFilter(
                        e.target.value as "ALL" | CashPaymentMethod,
                      )
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="ALL" className="bg-slate-900 text-white">
                      Todos
                    </option>
                    <option value="PIX" className="bg-slate-900 text-white">
                      PIX
                    </option>
                    <option value="CASH" className="bg-slate-900 text-white">
                      Dinheiro
                    </option>
                    <option value="CARD" className="bg-slate-900 text-white">
                      Cartao
                    </option>
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const today = todayDateInput();
                      setSelectedDate(today);
                      setForm((prev) => ({ ...prev, entryDate: today }));
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                  >
                    Atualizar
                  </button>
                </div>
              </div>
            </div>

            {loadingDashboard ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-6 text-sm text-slate-300">
                Carregando dados do caixa...
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/20 p-6 text-sm text-slate-400">
                Nenhum lancamento para a data selecionada.
              </div>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry) => {
                  const isIn = entry.type === "IN";
                  return (
                    <li
                      key={entry.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isIn
                                  ? "bg-emerald-300/15 text-emerald-200"
                                  : "bg-red-300/15 text-red-200"
                              }`}
                            >
                              {isIn ? "Entrada" : "Saida"}
                            </span>
                            {entry.category ? (
                              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                                {entry.category}
                              </span>
                            ) : null}
                            {entry.paymentMethod ? (
                              <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                                {entry.paymentMethod === "CASH"
                                  ? "Dinheiro"
                                  : entry.paymentMethod === "CARD"
                                    ? "Cartao"
                                    : "PIX"}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 text-sm font-medium text-white">
                            {entry.description}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDateTimeBR(entry.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                          <p
                            className={`text-base font-semibold ${
                              isIn ? "text-emerald-300" : "text-red-300"
                            }`}
                          >
                            {isIn ? "+" : "-"} {currency.format(entry.amount)}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDeleteEntry(entry.id)}
                            className="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

