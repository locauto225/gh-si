"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { UserCircle, Phone, Mail, Plus, Check } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Driver = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriversClient() {
  const router = useRouter();

  const [items, setItems]     = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [errList, setErrList] = useState<string | null>(null);

  // Filtres
  const [q, setQ]           = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");

  // Formulaire création
  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [creating, setCreating] = useState(false);
  const [errForm, setErrForm]   = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !creating;

  async function load() {
    setLoading(true);
    setErrList(null);
    try {
      const params = new URLSearchParams({ status, limit: "200" });
      if (q.trim()) params.set("q", q.trim());
      const res = await apiGet<{ items: Driver[] }>(`/drivers?${params}`);
      setItems(res.items ?? []);
    } catch (e) {
      setErrList(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  // Filtrage local sur q (debounce simple)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        (d.phone ?? "").toLowerCase().includes(s) ||
        (d.email ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    setErrForm(null);
    setSuccessMsg(null);
    try {
      await apiPost("/drivers", {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      setSuccessMsg(`Livreur « ${name.trim()} » créé.`);
      setName(""); setPhone(""); setEmail("");
      setShowForm(false);
      await load();
    } catch (e) {
      setErrForm(errMessage(e));
    } finally {
      setCreating(false);
    }
  }

  const hasActiveFilters = q.trim() || status !== "active";

  return (
    <div className="space-y-5">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Livreurs</h1>
            <p className="text-sm text-muted">
              {loading ? "Chargement…" : `${filtered.length} livreur${filtered.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setErrForm(null); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Annuler" : "Ajouter un livreur"}
        </button>
      </div>

      {/* ── Formulaire création ───────────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/60 space-y-4"
        >
          <div className="text-sm font-semibold text-foreground">Nouveau livreur</div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted">Nom complet *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jean Koné"
                required
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Téléphone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07 00 00 00 00"
                type="tel"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Email (optionnel)</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean@exemple.com"
                type="email"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
              />
            </div>
          </div>

          {errForm && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {errForm}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Création…" : "Créer le livreur"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setErrForm(null); setName(""); setPhone(""); setEmail(""); }}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* ── Message succès ───────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/60">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, téléphone, email…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
          >
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="all">Tous</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] disabled:opacity-50"
          >
            Rafraîchir
          </button>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => { setQ(""); setStatus("active"); }}
              className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* ── Erreur liste ─────────────────────────────────────────────────────── */}
      {errList && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {errList}
        </div>
      )}

      {/* ── Liste ────────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">
        <div className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 text-sm font-medium text-foreground rounded-t-xl">
          {loading ? "Chargement…" : `${filtered.length} livreur${filtered.length > 1 ? "s" : ""}`}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {hasActiveFilters ? "Aucun livreur pour ces critères." : "Aucun livreur."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((d) => (
              <div
                key={d.id}
                onClick={() => router.push(`/app/drivers/${d.id}`)}
                className="group flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_40%)]">
                    <UserCircle className="h-5 w-5 text-muted" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground group-hover:underline underline-offset-4 truncate">
                      {d.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      {d.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{d.phone}
                        </span>
                      )}
                      {d.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />{d.email}
                        </span>
                      )}
                      {!d.phone && !d.email && <span>Aucun contact renseigné</span>}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    d.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
                  ].join(" ")}>
                    {d.isActive ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}