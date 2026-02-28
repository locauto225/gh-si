// apps/web/src/app/(app)/app/stock/transfers/[id]/transfer-receive-form.tsx
"use client";

import { useMemo, useState } from "react";

export type TransferReceiveLine = {
  id: string;
  productId: string;
  qty: number;
  qtyReceived: number;
  note?: string | null;
  product?: { id: string; sku: string; name: string; unit?: string | null } | null;
};

export type TransferReceiveSubmitLine = {
  productId: string;
  qtyReceived: number;
};

function toIntSafe(raw: string): number | null {
  const cleaned = (raw ?? "").trim().replace(/\s/g, "").replace(/,/g, ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(n);
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function TransferReceiveForm({
  lines,
  disabled,
  maxQty = 1_000_000,
  note,
  onNoteChange,
  onSubmit,
  busy,
  submitLabel = "Enregistrer la réception",
  showTotals = true,
  showDeltaColumn = true,
}: {
  lines: TransferReceiveLine[];
  disabled?: boolean;
  maxQty?: number;
  note: string;
  onNoteChange: (v: string) => void;
  onSubmit: (payload: { note: string | null; lines: TransferReceiveSubmitLine[] }) => void | Promise<void>;
  busy?: boolean;
  submitLabel?: string;
  showTotals?: boolean;
  showDeltaColumn?: boolean;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const l of lines ?? []) map[l.id] = String(Number(l.qtyReceived ?? 0) || 0);
    return map;
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formErr, setFormErr] = useState<string | null>(null);

  const normalized = useMemo(() => {
    const out: Array<{
      id: string;
      productId: string;
      sent: number;
      received: number;
      receivedPreview: number;
      error?: string | null;
    }> = [];

    for (const l of lines ?? []) {
      const sent = Number(l.qty) || 0;
      const received = Number(l.qtyReceived) || 0;
      const raw = inputs[l.id] ?? String(received);
      const parsed = toIntSafe(raw);

      if (parsed === null) {
        out.push({ id: l.id, productId: l.productId, sent, received, receivedPreview: clampInt(received, 0, maxQty), error: null });
        continue;
      }
      if (Number.isNaN(parsed)) {
        out.push({ id: l.id, productId: l.productId, sent, received, receivedPreview: clampInt(received, 0, maxQty), error: "Nombre invalide" });
        continue;
      }
      const rec = clampInt(parsed, 0, maxQty);
      out.push({ id: l.id, productId: l.productId, sent, received, receivedPreview: rec, error: parsed !== rec ? `Doit être entre 0 et ${maxQty}` : null });
    }

    return out;
  }, [lines, inputs, maxQty]);

  const hasErrors = useMemo(() => normalized.some((x) => !!x.error), [normalized]);

  const totals = useMemo(() => {
    const sent = (lines ?? []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const receivedPreview = normalized.reduce((s, x) => s + (x.receivedPreview || 0), 0);
    return { sent, receivedPreview, deltaPreview: receivedPreview - sent };
  }, [lines, normalized]);

  function setLineInput(lineId: string, value: string) {
    setInputs((prev) => ({ ...prev, [lineId]: value }));
  }

  async function handleSubmit() {
    setFormErr(null);
    if (disabled || busy) return;
    if (hasErrors) {
      setFormErr("Corrige les erreurs avant de valider.");
      return;
    }
    await onSubmit({
      note: note.trim() ? note.trim() : null,
      lines: normalized.map((x) => ({ productId: x.productId, qtyReceived: x.receivedPreview })),
    });
  }

  return (
    <div id="transfer-receive" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Réception des produits</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Saisis la quantité effectivement reçue par ligne. Les valeurs doivent être des entiers entre 0 et {maxQty}.
          </div>
        </div>

        {showTotals && (
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Totaux (aperçu)</div>
            <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">
              Envoyé <span className="font-semibold">{totals.sent}</span> · Reçu{" "}
              <span className="font-semibold">{totals.receivedPreview}</span>
            </div>
            <div className="mt-0.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Écart </span>
              <span className={[
                "font-semibold",
                totals.deltaPreview === 0 ? "text-slate-700 dark:text-slate-200"
                : totals.deltaPreview < 0 ? "text-amber-700 dark:text-amber-200"
                : "text-emerald-700 dark:text-emerald-200",
              ].join(" ")}>
                {totals.deltaPreview > 0 ? `+${totals.deltaPreview}` : String(totals.deltaPreview)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="min-w-[520px] w-full text-left text-sm text-slate-900 dark:text-slate-100">
          <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2">Produit</th>
              <th className="px-3 py-2 text-right">Envoyé</th>
              <th className="px-3 py-2 text-right">Réceptionné</th>
              {showDeltaColumn && <th className="px-3 py-2 text-right">Écart</th>}
              <th className="px-3 py-2 hidden lg:table-cell">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => {
              const n = normalized.find((x) => x.id === l.id);
              const sent = Number(l.qty) || 0;
              const recPreview = n?.receivedPreview ?? (Number(l.qtyReceived) || 0);
              const diff = recPreview - sent;
              const diffClass =
                diff === 0 ? "text-slate-600 dark:text-slate-300"
                : diff < 0 ? "text-amber-700 dark:text-amber-200"
                : "text-emerald-700 dark:text-emerald-200";
              const hasErr = !!n?.error;
              const showErr = hasErr && !!touched[l.id];

              return (
                <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.product?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {l.product?.sku ? `SKU : ${l.product.sku}` : ""}
                      {l.product?.unit ? ` · ${l.product.unit}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{sent}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      inputMode="numeric"
                      disabled={disabled || busy}
                      value={inputs[l.id] ?? String(Number(l.qtyReceived ?? 0) || 0)}
                      onChange={(e) => setLineInput(l.id, e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, [l.id]: true }))}
                      className={[
                        "ml-auto w-20 sm:w-24 rounded-md border bg-white px-2 py-1 text-right text-sm font-medium outline-none focus:ring-2",
                        showErr
                          ? "border-red-300 focus:ring-red-200 dark:border-red-900/60 dark:focus:ring-red-900/30"
                          : "border-slate-200 focus:ring-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-slate-800",
                        disabled || busy ? "opacity-60" : "",
                      ].join(" ")}
                    />
                  </td>
                  {showDeltaColumn && (
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${diffClass}`}>
                      {diff === 0 ? "0" : diff > 0 ? `+${diff}` : String(diff)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs hidden lg:table-cell">
                    {showErr ? (
                      <span className="text-red-700 dark:text-red-200">{n?.error}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!lines?.length && (
              <tr>
                <td colSpan={showDeltaColumn ? 5 : 4} className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Aucune ligne à réceptionner.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">Note de réception (optionnel)</div>
        <input
          disabled={disabled || busy}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Ex : cartons abîmés, manque 2 unités…"
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-slate-800"
        />
      </div>

      {formErr && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {formErr}
        </div>
      )}

      {/* ✅ Indication d'erreur inline visible uniquement si des champs ont une erreur non encore touchés */}
      {hasErrors && Object.keys(touched).length === 0 && (
        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Clique hors d'un champ pour afficher les erreurs de saisie.
        </div>
      )}

      <button
        type="button"
        disabled={disabled || busy || !lines?.length}
        onClick={handleSubmit}
        className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* ✅ Label clair pendant le chargement */}
        {busy ? "Enregistrement…" : submitLabel}
      </button>
    </div>
  );
}