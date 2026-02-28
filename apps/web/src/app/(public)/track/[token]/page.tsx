// app/(public)/track/[token]/page.tsx
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackResponse = {
  item: {
    id: string;
    number: string;
    status: string;
    note?: string | null;
    preparedAt?: string | null;
    dispatchedAt?: string | null;
    deliveredAt?: string | null;
    receiverName?: string | null;
    receiverPhone?: string | null;
    proofNote?: string | null;
    sale?: {
      number?: string;
      client?: { name?: string } | null;
    } | null;
    warehouse?: { name?: string; code?: string } | null;
    lines?: Array<{
      id: string;
      qtyDelivered: number;
      saleLine: {
        qty: number;
        product: { name: string; sku: string; unit: string };
      };
    }>;
    events?: Array<{
      id: string;
      type: string;
      status?: string | null;
      message?: string | null;
      createdAt: string;
    }>;
  };
};

// ─── Config statuts ───────────────────────────────────────────────────────────

type StatusCfg = {
  label: string;
  headline: string;
  sub: string;
  step: 0 | 1 | 2 | 3;
  accent: string;
  isDone: boolean;
  isFailed: boolean;
};

const STATUS_CFG: Record<string, StatusCfg> = {
  DRAFT: {
    label: "En préparation", step: 0,
    headline: "Votre commande est en cours de préparation",
    sub: "Nos équipes s'activent pour préparer votre envoi avec soin.",
    accent: "#78716c", isDone: false, isFailed: false,
  },
  PREPARED: {
    label: "Prête au départ", step: 1,
    headline: "Votre commande est prête !",
    sub: "Emballée et étiquetée. Elle sera prise en charge par notre livreur très prochainement.",
    accent: "#f59e0b", isDone: false, isFailed: false,
  },
  OUT_FOR_DELIVERY: {
    label: "En route", step: 2,
    headline: "Le livreur est en chemin \u2728",
    sub: "Votre commande est dans le véhicule de livraison et arrive chez vous aujourd'hui.",
    accent: "#fb923c", isDone: false, isFailed: false,
  },
  PARTIALLY_DELIVERED: {
    label: "Livraison partielle", step: 3,
    headline: "Une partie de votre commande est arrivée",
    sub: "Le reliquat sera livré lors d'un prochain passage. Merci de votre compréhension.",
    accent: "#f59e0b", isDone: true, isFailed: false,
  },
  DELIVERED: {
    label: "Livrée ✓", step: 3,
    headline: "Commande livrée avec succès !",
    sub: "Votre commande est bien entre vos mains. Merci de nous faire confiance.",
    accent: "#10b981", isDone: true, isFailed: false,
  },
  FAILED: {
    label: "Incident", step: 2,
    headline: "Nous n'avons pas pu livrer",
    sub: "Un problème est survenu lors de la tentative de livraison. Nos équipes vont vous recontacter.",
    accent: "#ef4444", isDone: false, isFailed: true,
  },
  CANCELLED: {
    label: "Annulée", step: 0,
    headline: "Commande annulée",
    sub: "Cette commande a été annulée. Contactez votre interlocuteur habituel pour plus d'informations.",
    accent: "#78716c", isDone: false, isFailed: true,
  },
};

const EVENT_LABELS: Record<string, string> = {
  NOTE: "Note", CALL: "Appel téléphonique", ISSUE: "Incident",
  ATTEMPT: "Tentative de livraison", RESCHEDULED: "Reprogrammé",
  RETURNED: "Retour entrepôt", PREPARED: "Préparation", CUSTOM: "Événement",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function API_URL() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:4000";
}

function maskPhone(phone?: string | null) {
  const p = (phone ?? "").trim();
  if (!p) return null;
  if (p.length <= 2) return "••";
  return `${"•".repeat(Math.max(0, p.length - 2))}${p.slice(-2)}`;
}

function fmt(dt?: string | null) {
  if (!dt) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(dt));
  } catch { return dt; }
}

function fmtShort(dt?: string | null) {
  if (!dt) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(dt));
  } catch { return dt; }
}

async function fetchTrack(token: string): Promise<TrackResponse> {
  const url = `${API_URL()}/deliveries/track/${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Erreur API (${res.status})`);
  return (await res.json()) as TrackResponse;
}

// ─── SVG Icons inline (pas de dépendance lucide côté client) ─────────────────

const IconBox = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
const IconTruck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
const IconCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const IconUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
const IconCalendar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`;
const IconWarehouse = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M2 9l10-6 10 6"/></svg>`;
const IconFile = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data: TrackResponse | null = null;
  let error: string | null = null;

  try {
    data = await fetchTrack(token);
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : "Erreur de suivi";
  }

  if (error || !data?.item) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        <main className="t-root">
          <div className="t-bg-blur" />
          <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
            <div className="t-error-card">
              <AlertCircle size={44} color="#ef4444" style={{ margin: "0 auto 1.25rem", display: "block" }} />
              <h1>Lien introuvable</h1>
              <p>Ce lien de suivi est invalide ou a expiré. Contactez votre fournisseur pour obtenir un nouveau lien.</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const d = data.item;
  const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.PREPARED;
  const progressPct = Math.round((cfg.step / 3) * 100);
  const clientName = d.receiverName || d.sale?.client?.name || null;
  const hasLines = Array.isArray(d.lines) && d.lines.length > 0;
  const hasEvents = Array.isArray(d.events) && d.events.length > 0;

  const STEPS = [
    { label: "Préparation", icon: IconBox,   date: d.preparedAt,   done: cfg.step >= 1, active: cfg.step === 1 },
    { label: "En livraison", icon: IconTruck, date: d.dispatchedAt, done: cfg.step >= 2, active: cfg.step === 2 },
    { label: "Livraison",   icon: IconCheck, date: d.deliveredAt,  done: cfg.step >= 3, active: cfg.step === 3 },
  ];

  const accent = cfg.accent;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + dynamicCSS(accent, progressPct, cfg.isDone) }} />

      <main className="t-root">
        {/* Fond décoratif */}
        <div className="t-bg-blur" />
        {cfg.isDone && <div className="t-confetti-burst" aria-hidden="true" />}

        <div className="t-wrap">

          {/* ── Logo ─────────────────────────────────────────────── */}
          <header className="t-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="t-logo" />
          </header>

          {/* ── Carte héro ───────────────────────────────────────── */}
          <section className="t-card t-card-hero">

            {/* Badge statut animé */}
            <div className="t-badge">
              <span className="t-badge-dot" />
              {cfg.label}
            </div>

            {/* Headline */}
            <h1 className="t-headline">{cfg.headline}</h1>
            <p className="t-sub">{cfg.sub}</p>

            {/* Numéro de référence */}
            <div className="t-ref">
              <span className="t-ref-label">Référence</span>
              <span className="t-ref-value">{d.number}</span>
            </div>

            {/* Barre de progression */}
            <div className="t-progressbar">
              <div className="t-progressbar-track">
                <div className="t-progressbar-fill" />
              </div>
            </div>

            {/* Steps */}
            <div className="t-steps">
              {STEPS.map((s, i) => (
                <div key={i} className={`t-step${s.done ? " t-step-done" : ""}${s.active ? " t-step-active" : ""}`}>
                  <div className="t-step-icon"
                    dangerouslySetInnerHTML={{ __html: s.icon }} />
                  <span className="t-step-label">{s.label}</span>
                  {s.date && <span className="t-step-date">{fmtShort(s.date)}</span>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Carte destinataire ───────────────────────────────── */}
          <section className="t-card t-card-info">

            {clientName && (
              <div className="t-info-row">
                <div className="t-info-icon" dangerouslySetInnerHTML={{ __html: IconUser }} />
                <div>
                  <div className="t-info-label">Destinataire</div>
                  <div className="t-info-value">{clientName}</div>
                  {maskPhone(d.receiverPhone) && (
                    <div className="t-info-meta">{maskPhone(d.receiverPhone)}</div>
                  )}
                </div>
              </div>
            )}

            {d.warehouse?.name && (
              <div className="t-info-row t-info-row-border">
                <div className="t-info-icon" dangerouslySetInnerHTML={{ __html: IconWarehouse }} />
                <div>
                  <div className="t-info-label">Expédié depuis</div>
                  <div className="t-info-value">{d.warehouse.name}{d.warehouse.code ? ` (${d.warehouse.code})` : ""}</div>
                </div>
              </div>
            )}

            {fmt(d.deliveredAt || d.dispatchedAt) && (
              <div className="t-info-row t-info-row-border">
                <div className="t-info-icon" dangerouslySetInnerHTML={{ __html: IconCalendar }} />
                <div>
                  <div className="t-info-label">
                    {d.deliveredAt ? "Livré le" : "Départ le"}
                  </div>
                  <div className="t-info-value">{fmt(d.deliveredAt ?? d.dispatchedAt)}</div>
                </div>
              </div>
            )}

          </section>

          {/* ── Produits ─────────────────────────────────────────── */}
          {hasLines && (
            <section className="t-card">
              <div className="t-section-head">
                <h2 className="t-section-title">Contenu de l'envoi</h2>
                <span className="t-section-badge">
                  {d.lines!.length} article{d.lines!.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="t-lines">
                {d.lines!.map((l) => {
                  const isPartial = l.qtyDelivered < l.saleLine.qty;
                  return (
                    <div key={l.id} className="t-line">
                      <div className="t-line-thumb" dangerouslySetInnerHTML={{ __html: IconBox }} />
                      <div className="t-line-info">
                        <span className="t-line-name">{l.saleLine.product.name}</span>
                        <span className="t-line-sku">{l.saleLine.product.sku} · {l.saleLine.product.unit}</span>
                      </div>
                      <div className="t-line-qty">
                        <span className="t-line-qty-val">×{l.qtyDelivered}</span>
                        {isPartial && (
                          <span className="t-line-qty-partial">/{l.saleLine.qty}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Note ─────────────────────────────────────────────── */}
          {d.note && (
            <section className="t-card t-card-note">
              <div className="t-note-icon" dangerouslySetInnerHTML={{ __html: IconFile }} />
              <div>
                <div className="t-note-label">Note de livraison</div>
                <p className="t-note-text">{d.note}</p>
              </div>
            </section>
          )}

          {/* ── Historique ───────────────────────────────────────── */}
          {hasEvents && (
            <section className="t-card">
              <div className="t-section-head">
                <h2 className="t-section-title">Historique</h2>
                <span className="t-section-badge">{d.events!.length}</span>
              </div>
              <div className="t-timeline">
                {d.events!
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((e, i) => (
                    <div key={e.id ?? i} className="t-event">
                      <div className="t-event-spine" />
                      <div className="t-event-body">
                        <div className="t-event-head">
                          <span className="t-event-type">
                            {EVENT_LABELS[e.type] ?? e.type}
                          </span>
                          <span className="t-event-date">{fmtShort(e.createdAt)}</span>
                        </div>
                        {e.message && <p className="t-event-msg">{e.message}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* ── Footer ───────────────────────────────────────────── */}
          <footer className="t-footer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="t-footer-logo" />
            <p>Pour toute question, contactez votre service logistique.</p>
            <p className="t-footer-legal">Les informations sensibles sont partiellement masquées pour votre sécurité.</p>
          </footer>

        </div>
      </main>
    </>
  );
}

// ─── CSS de base (statique) ───────────────────────────────────────────────────

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --warm-0:   #fffdf9;
  --warm-50:  #faf7f2;
  --warm-100: #f2ede4;
  --warm-200: #e2d8cc;
  --warm-300: #c8bfb5;
  --warm-500: #a09080;
  --warm-700: #6b5f55;
  --warm-900: #1a1714;
  --bg:       #0f0d0a;
  --radius-card: 2rem;
  --shadow-card: 0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.12);
}

.t-root {
  min-height: 100dvh;
  background: var(--bg);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--warm-900);
  position: relative;
  overflow-x: hidden;
}

/* ─ Fond décoratif ─ */
.t-bg-blur {
  position: fixed; top: -30vh; left: 50%; transform: translateX(-50%);
  width: 70vw; height: 70vw; max-width: 600px; max-height: 600px;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent, #fb923c) 20%, transparent), transparent 70%);
  filter: blur(80px); pointer-events: none; z-index: 0;
  transition: background 1.2s ease;
}

/* ─ Confetti livré ─ */
.t-confetti-burst {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0;
  background-image:
    radial-gradient(circle at 20% 10%, #10b981 0, #10b981 3px, transparent 3px),
    radial-gradient(circle at 80% 15%, #fb923c 0, #fb923c 2px, transparent 2px),
    radial-gradient(circle at 50% 5%, #f59e0b 0, #f59e0b 3px, transparent 3px),
    radial-gradient(circle at 35% 20%, #10b981 0, #10b981 2px, transparent 2px),
    radial-gradient(circle at 65% 8%, #fb923c 0, #fb923c 3px, transparent 3px);
  animation: confettiFall 3s ease-out forwards;
}
@keyframes confettiFall {
  from { opacity: 1; transform: translateY(-10px); }
  to   { opacity: 0; transform: translateY(40px); }
}

/* ─ Layout ─ */
.t-wrap {
  position: relative; z-index: 1;
  max-width: 500px; margin: 0 auto; padding: 0 1.25rem 5rem;
}

/* ─ Header ─ */
.t-header {
  padding: 2.5rem 0 2rem; text-align: center;
}
.t-logo {
  height: 46px; width: auto; object-fit: contain;
  filter: brightness(0) invert(1); opacity: 0.92;
  display: inline-block;
}

/* ─ Cards ─ */
.t-card {
  background: var(--warm-0);
  border-radius: var(--radius-card);
  padding: 2rem 1.75rem;
  margin-bottom: 0.875rem;
  box-shadow: var(--shadow-card);
  animation: slideUp 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both;
}
.t-card:nth-child(2) { animation-delay: 0.08s; }
.t-card:nth-child(3) { animation-delay: 0.14s; }
.t-card:nth-child(4) { animation-delay: 0.20s; }
.t-card:nth-child(5) { animation-delay: 0.26s; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.t-card-hero {
  padding-bottom: 2.25rem;
}

.t-card-info {
  padding: 0.5rem 1.75rem;
}

.t-card-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  display: flex; gap: 1rem; align-items: flex-start;
}

/* ─ Badge ─ */
.t-badge {
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent, #fb923c);
  background: color-mix(in srgb, var(--accent, #fb923c) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #fb923c) 25%, transparent);
  padding: 0.375rem 0.875rem; border-radius: 999px;
  margin-bottom: 1.25rem;
}
.t-badge-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent, #fb923c);
  animation: badgePulse 2s ease-in-out infinite;
}
@keyframes badgePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.75); }
}

/* ─ Headline ─ */
.t-headline {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(1.75rem, 5.5vw, 2.25rem);
  font-weight: 400;
  line-height: 1.18;
  color: var(--warm-900);
  letter-spacing: -0.025em;
  margin-bottom: 0.625rem;
}
.t-sub {
  font-size: 0.9375rem;
  color: var(--warm-500);
  line-height: 1.65;
  margin-bottom: 1.5rem;
  font-weight: 400;
}

/* ─ Ref ─ */
.t-ref {
  display: inline-flex; align-items: center; gap: 0.625rem;
  background: var(--warm-50); border-radius: 0.75rem;
  padding: 0.5rem 1rem; margin-bottom: 2rem;
}
.t-ref-label {
  font-size: 0.6875rem; color: var(--warm-500);
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
}
.t-ref-value {
  font-family: 'Instrument Serif', serif;
  font-size: 1rem; color: var(--warm-900);
}

/* ─ Progress bar ─ */
.t-progressbar { margin-bottom: 1.75rem; }
.t-progressbar-track {
  height: 5px; background: var(--warm-100); border-radius: 999px; overflow: hidden;
}
.t-progressbar-fill {
  height: 100%; border-radius: 999px;
  background: var(--accent, #fb923c);
  width: var(--progress-pct, 0%);
  transition: width 1.4s cubic-bezier(0.34, 1.2, 0.64, 1);
  position: relative;
}
.t-progressbar-fill::after {
  content: '';
  position: absolute; right: 0; top: 0; bottom: 0;
  width: 60px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5));
  border-radius: 999px;
  animation: shimmer 2s ease-in-out infinite;
}
@keyframes shimmer {
  from { opacity: 0; } 50% { opacity: 1; } to { opacity: 0; }
}

/* ─ Steps ─ */
.t-steps {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;
}
.t-step {
  display: flex; flex-direction: column; align-items: center; gap: 0.375rem;
}
.t-step-icon {
  width: 48px; height: 48px; border-radius: 1.25rem;
  background: var(--warm-100); color: var(--warm-300);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.4s ease;
}
.t-step-icon svg { width: 22px; height: 22px; }
.t-step-done .t-step-icon {
  background: var(--accent, #fb923c);
  color: #fff;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent, #fb923c) 35%, transparent);
}
.t-step-active .t-step-icon {
  background: color-mix(in srgb, var(--accent, #fb923c) 15%, white);
  color: var(--accent, #fb923c);
  border: 2px solid color-mix(in srgb, var(--accent, #fb923c) 30%, transparent);
  animation: stepPulse 2.2s ease-in-out infinite;
}
@keyframes stepPulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent, #fb923c) 25%, transparent); }
  50%       { box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent, #fb923c) 5%, transparent); }
}
.t-step-label {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--warm-300); text-align: center;
}
.t-step-done .t-step-label,
.t-step-active .t-step-label { color: var(--warm-700); }
.t-step-date {
  font-size: 0.625rem; color: var(--warm-300); text-align: center; line-height: 1.4;
}

/* ─ Info rows ─ */
.t-info-row {
  display: flex; align-items: center; gap: 1rem;
  padding: 1.125rem 0;
}
.t-info-row-border { border-top: 1px solid var(--warm-100); }
.t-info-icon {
  width: 44px; height: 44px; border-radius: 1.25rem; flex-shrink: 0;
  background: var(--warm-50); color: var(--warm-500);
  display: flex; align-items: center; justify-content: center;
}
.t-info-icon svg { width: 19px; height: 19px; }
.t-info-label {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--warm-300); margin-bottom: 0.2rem;
}
.t-info-value { font-size: 0.9375rem; font-weight: 600; color: var(--warm-900); }
.t-info-meta { font-size: 0.8125rem; color: var(--warm-500); margin-top: 0.125rem; }

/* ─ Section header ─ */
.t-section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.5rem;
}
.t-section-title {
  font-family: 'Instrument Serif', serif;
  font-size: 1.25rem; font-weight: 400; color: var(--warm-900);
}
.t-section-badge {
  font-size: 0.75rem; font-weight: 700; color: var(--warm-500);
  background: var(--warm-100); padding: 0.25rem 0.75rem; border-radius: 999px;
}

/* ─ Lignes produits ─ */
.t-lines { display: flex; flex-direction: column; gap: 0.75rem; }
.t-line {
  display: flex; align-items: center; gap: 1rem;
  background: var(--warm-50); border-radius: 1.25rem;
  padding: 1rem 1.25rem;
  transition: background 0.2s;
}
.t-line:hover { background: var(--warm-100); }
.t-line-thumb {
  width: 42px; height: 42px; border-radius: 1rem; flex-shrink: 0;
  background: var(--warm-100); color: var(--warm-300);
  display: flex; align-items: center; justify-content: center;
}
.t-line-thumb svg { width: 20px; height: 20px; }
.t-line-info { flex: 1; min-width: 0; }
.t-line-name { display: block; font-weight: 700; font-size: 0.9375rem; color: var(--warm-900); }
.t-line-sku  { display: block; font-size: 0.6875rem; color: var(--warm-300); margin-top: 0.125rem; text-transform: uppercase; letter-spacing: 0.04em; }
.t-line-qty  { display: flex; align-items: baseline; gap: 0.25rem; flex-shrink: 0; }
.t-line-qty-val { font-family: 'Instrument Serif', serif; font-size: 1.25rem; color: var(--accent, #fb923c); font-weight: 400; }
.t-line-qty-partial { font-size: 0.75rem; color: var(--warm-300); }

/* ─ Note ─ */
.t-note-icon {
  width: 40px; height: 40px; border-radius: 1rem; flex-shrink: 0;
  background: #fef3c7; color: #d97706;
  display: flex; align-items: center; justify-content: center;
}
.t-note-icon svg { width: 18px; height: 18px; }
.t-note-label { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #92400e; margin-bottom: 0.3rem; }
.t-note-text { font-size: 0.9rem; color: #78350f; line-height: 1.65; }

/* ─ Timeline ─ */
.t-timeline { display: flex; flex-direction: column; gap: 0; }
.t-event { display: flex; gap: 1rem; padding-bottom: 1.25rem; position: relative; }
.t-event:last-child { padding-bottom: 0; }
.t-event-spine {
  position: absolute; left: 0; top: 1.5rem; bottom: 0;
  width: 2px; background: var(--warm-100);
  border-radius: 999px;
}
.t-event:last-child .t-event-spine { display: none; }
.t-event-body { padding-left: 1.5rem; }
.t-event-head {
  display: flex; align-items: baseline;
  justify-content: space-between; gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.t-event-type { font-weight: 700; font-size: 0.875rem; color: var(--warm-900); }
.t-event-date { font-size: 0.6875rem; color: var(--warm-300); white-space: nowrap; }
.t-event-msg  { font-size: 0.8125rem; color: var(--warm-500); line-height: 1.55; }

/* ─ Footer ─ */
.t-footer {
  text-align: center; padding: 2.5rem 0 0;
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
}
.t-footer-logo {
  height: 30px; width: auto; object-fit: contain;
  filter: brightness(0) invert(1); opacity: 0.3;
  margin-bottom: 0.5rem;
}
.t-footer p { font-size: 0.75rem; color: #6b5f55; }
.t-footer-legal { font-size: 0.6875rem; color: #3d3530; }

/* ─ Error card ─ */
.t-error-card {
  background: #1c1812; border: 1px solid #2e2619;
  border-radius: 2.5rem; padding: 3.5rem 2.5rem;
  max-width: 380px; text-align: center; color: #ede8df;
}
.t-error-card h1 {
  font-family: 'Instrument Serif', serif;
  font-size: 1.75rem; margin-bottom: 0.75rem; font-weight: 400;
}
.t-error-card p { color: #a09080; font-size: 0.9rem; line-height: 1.65; }
`;

// ─── CSS dynamique (dépend du statut) ────────────────────────────────────────

function dynamicCSS(accent: string, progressPct: number, isDone: boolean) {
  return `
    :root {
      --accent: ${accent};
      --progress-pct: ${progressPct}%;
    }
    ${isDone ? `
      .t-card-hero {
        background: linear-gradient(135deg, #f0fdf4 0%, #fffdf9 60%);
      }
    ` : ""}
  `;
}