"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import {
  UserCircle, Phone, Mail, ChevronRight,
  Truck, Route, Check, X, Pencil,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Driver = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
};

type TripStatus = "DRAFT" | "LOADED" | "IN_PROGRESS" | "DONE" | "CLOSED" | "CANCELLED";

type TripRow = {
  id: string;
  number: string;
  status: TripStatus;
  createdAt: string;
  departureDate?: string | null;
  fromWarehouse?: { id: string; name: string; code: string } | null;
  _count?: { stops: number; deliveries: number } | null;
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(dt));
  } catch { return dt; }
}

const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  DRAFT: "En préparation", LOADED: "Chargée", IN_PROGRESS: "En cours",
  DONE: "Terminée", CLOSED: "Clôturée", CANCELLED: "Annulée",
};

const TRIP_STATUS_CLS: Record<TripStatus, string> = {
  DRAFT:       "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  LOADED:      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  IN_PROGRESS: "border-primary/30 bg-primary/5 text-primary dark:text-orange-300",
  DONE:        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  CLOSED:      "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
  CANCELLED:   "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverDetailsClient({ id }: { id: string }) {
  const router = useRouter();

  const [driver, setDriver]       = useState<Driver | null>(null);
  const [trips, setTrips]         = useState<TripRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mode édition
  const [editing, setEditing]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [errEdit, setErrEdit]   = useState<string | null>(null);
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [email, setEmail]       = useState("");
  const [isActive, setIsActive] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [driverRes, tripsRes] = await Promise.all([
        apiGet<Driver>(`/drivers/${id}`),
        apiGet<{ items: TripRow[] }>(`/delivery-trips?driverId=${id}&limit=50`),
      ]);
      setDriver(driverRes);
      setTrips(tripsRes.items ?? []);
      // Prépeupler les champs édition
      setName(driverRes.name);
      setPhone(driverRes.phone ?? "");
      setEmail(driverRes.email ?? "");
      setIsActive(driverRes.isActive);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setErrEdit(null);
    try {
      const updated = await apiPatch<Driver>(`/drivers/${id}`, {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        isActive,
      });
      setDriver(updated);
      setEditing(false);
      setSuccessMsg("Livreur mis à jour.");
    } catch (e) {
      setErrEdit(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!driver || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await apiPatch<Driver>(`/drivers/${id}`, {
        isActive: !driver.isActive,
      });
      setDriver(updated);
      setIsActive(updated.isActive);
      setSuccessMsg(updated.isActive ? "Livreur réactivé." : "Livreur désactivé.");
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // ─── États de chargement / erreur ─────────────────────────────────────────

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Chargement…</div>;
  }

  if (!driver) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        {err ?? "Livreur introuvable."}
        <div className="mt-3">
          <Link href="/app/drivers" className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm hover:bg-red-50 dark:border-red-900/50 dark:bg-transparent">
            ← Retour aux livreurs
          </Link>
        </div>
      </div>
    );
  }

  const tripsActive = trips.filter((t) =>
    t.status === "IN_PROGRESS" || t.status === "LOADED" || t.status === "DRAFT"
  );
  const tripsHistory = trips.filter((t) =>
    t.status === "DONE" || t.status === "CLOSED" || t.status === "CANCELLED"
  );

  return (
    <div className="space-y-5">

      {/* ── Fil d'Ariane ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/drivers" className="hover:text-foreground hover:underline underline-offset-4">
          Livreurs
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{driver.name}</span>
      </div>

      {/* ── Carte identité ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
              <UserCircle className="h-6 w-6 text-muted" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{driver.name}</span>
                <span className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  driver.isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
                ].join(" ")}>
                  {driver.isActive ? "Actif" : "Inactif"}
                </span>
              </div>
              <div className="text-xs text-muted">Livreur depuis le {fmtDate(driver.createdAt)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditing((v) => !v); setErrEdit(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editing ? "Annuler" : "Modifier"}
            </button>
            <button
              type="button"
              onClick={toggleActive}
              disabled={busy}
              className={[
                "rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50",
                driver.isActive
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
              ].join(" ")}
            >
              {driver.isActive ? "Désactiver" : "Réactiver"}
            </button>
            <Link href="/app/drivers" className="text-xs text-muted hover:underline underline-offset-4">
              ← Retour
            </Link>
          </div>
        </div>

        {/* Feedback */}
        {successMsg && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Check className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}
        {err && (
          <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}

        {/* Infos ou formulaire édition */}
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted">Nom complet *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Téléphone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  placeholder="07 00 00 00 00"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="jean@exemple.com"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Livreur actif
                </label>
              </div>
            </div>

            {errEdit && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {errEdit}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setErrEdit(null); setName(driver.name); setPhone(driver.phone ?? ""); setEmail(driver.email ?? ""); setIsActive(driver.isActive); }}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Phone className="h-3.5 w-3.5" /> Téléphone
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {driver.phone ?? <span className="font-normal text-muted">—</span>}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Mail className="h-3.5 w-3.5" /> Email
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {driver.email ?? <span className="font-normal text-muted">—</span>}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Truck className="h-3.5 w-3.5" /> Tournées
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {trips.length}
                <span className="ml-1 text-xs font-normal text-muted">au total</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Tournées actives ─────────────────────────────────────────────────── */}
      {tripsActive.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            Tournées en cours
            <span className="ml-2 font-normal text-muted">{tripsActive.length}</span>
          </h2>
          <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60 divide-y divide-border">
            {tripsActive.map((t) => (
              <Link
                key={t.id}
                href={`/app/trips/${t.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Route className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t.number}</div>
                    <div className="text-xs text-muted">
                      {t.fromWarehouse?.name ?? "—"}
                      {t._count?.stops != null && ` · ${t._count.stops} arrêt${t._count.stops > 1 ? "s" : ""}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TRIP_STATUS_CLS[t.status]}`}>
                    {TRIP_STATUS_LABELS[t.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Historique tournées ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          Historique
          <span className="ml-2 font-normal text-muted">{tripsHistory.length} tournée{tripsHistory.length > 1 ? "s" : ""}</span>
        </h2>

        {tripsHistory.length === 0 && tripsActive.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">
            Aucune tournée pour ce livreur.
          </div>
        ) : tripsHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted">
            Aucune tournée terminée.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60 divide-y divide-border">
            {tripsHistory.map((t) => (
              <Link
                key={t.id}
                href={`/app/trips/${t.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Route className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{t.number}</div>
                    <div className="text-xs text-muted">
                      {fmtDate(t.departureDate ?? t.createdAt)}
                      {t.fromWarehouse?.name ? ` · ${t.fromWarehouse.name}` : ""}
                      {t._count?.stops != null ? ` · ${t._count.stops} arrêt${t._count.stops > 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TRIP_STATUS_CLS[t.status]}`}>
                    {TRIP_STATUS_LABELS[t.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}