"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
  contactName?: string | null;
  address?: string | null;
  note?: string | null;
  taxId?: string | null;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
  createdAt?: string;
};

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ✅ Parse numérique propre — plus de "as any"
function parseIntOrNull(v: string): number | null {
  const s = v.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

export default function SuppliersClient() {
  const router = useRouter();

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // ✅ Erreurs séparées
  const [errList, setErrList] = useState<string | null>(null);
  const [errForm, setErrForm] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [q, setQ] = useState("");

  // Formulaire création
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [note, setNote] = useState("");

  // ✅ Bouton désactivé si nom vide
  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  async function load() {
    setLoading(true);
    setErrList(null);
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await apiGet<{ items: Supplier[] }>(`/suppliers?${qs}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErrList(errMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Recherche avec debounce — plus de bouton "Rechercher" manuel
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function resetForm() {
    setName("");
    setContactName("");
    setTaxId("");
    setPaymentTermsDays("");
    setCreditLimit("");
    setNote("");
    setErrForm(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrForm(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ item: Supplier }>("/suppliers", {
        name: name.trim(),
        contactName: contactName.trim() || null,
        taxId: taxId.trim() || null,
        // ✅ Parse propre — plus de "as any"
        paymentTermsDays: parseIntOrNull(paymentTermsDays),
        creditLimit: parseIntOrNull(creditLimit),
        note: note.trim() || null,
      });
      // ✅ Message de succès
      setSuccess(`Fournisseur "${res.item?.name ?? name.trim()}" créé.`);
      resetForm();
      await load();
    } catch (e: unknown) {
      setErrForm(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Feedback succès */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Formulaire création */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Nouveau fournisseur
        </div>

        <div className="grid gap-3 md:grid-cols-10">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Brasserie ABC"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Contact <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nom du contact"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            {/* ✅ Placeholder sans clé API "taxId" */}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              N° contribuable <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="CI123456789"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-1">
            {/* ✅ Label complet */}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Délai <span className="font-normal text-slate-400">(j)</span>
            </label>
            <input
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Plafond crédit <span className="font-normal text-slate-400">(FCFA)</span>
            </label>
            <input
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              inputMode="numeric"
              placeholder="1 000 000"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-10">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Note <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Commentaire, conditions particulières…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            Réinitialiser
          </button>
          {/* ✅ CTA clair + désactivé si invalide + ellipse correcte */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? "Création…" : "Ajouter le fournisseur"}
          </button>
        </div>

        {errForm && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {errForm}
          </div>
        )}
      </form>

      {/* Erreur liste */}
      {errList && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {errList}
        </div>
      )}

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Compteur + pluriel correct */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
            {loading
              ? "Chargement…"
              : `${items.length} fournisseur${items.length > 1 ? "s" : ""}`}
          </div>

          {/* ✅ Debounce — bouton "Rechercher" supprimé */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (nom, contact…)"
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {q.trim() ? "Aucun fournisseur ne correspond." : "Aucun fournisseur."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Contact</th>
                  {/* ✅ Unité dans l'en-tête */}
                  <th className="px-4 py-3">Délai paiement</th>
                  <th className="px-4 py-3 text-right">Plafond crédit</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id}
                    // ✅ Ligne cliquable — navigation vers la fiche fournisseur
                    onClick={() => router.push(`/app/suppliers/${s.id}`)}
                    className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {s.contactName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {/* ✅ Unité "j" dans la cellule */}
                      {typeof s.paymentTermsDays === "number"
                        ? `${s.paymentTermsDays} j`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                      {typeof s.creditLimit === "number" ? formatXOF(s.creditLimit) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          s.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
                        }`}
                      >
                        {s.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}