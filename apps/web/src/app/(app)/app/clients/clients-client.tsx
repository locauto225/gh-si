"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
// ✅ Import valeur — pas "import type" sinon instanceof échoue au runtime
import { ApiError, apiDelete, apiGet, apiPost, apiFetch } from "@/lib/api";

type Client = {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  taxId?: string | null;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "active" | "inactive" | "all";

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ✅ instanceof ApiError — plus de (e as any).name
function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

export default function ClientsClient() {
  const router = useRouter();

  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  // ✅ Erreurs séparées — liste vs formulaire
  const [errList, setErrList] = useState<string | null>(null);
  const [errForm, setErrForm] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>("active");
  const [q, setQ] = useState("");

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // ✅ Confirmation suppression inline
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Formulaire création
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  // ✅ Bouton désactivé si nom vide
  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  const paymentTermsDaysInt = useMemo(() => {
    const v = paymentTermsDays.trim();
    if (!v) return null;
    const n = Number(v.replace(/\s/g, "").replace(/,/g, "."));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.trunc(n);
  }, [paymentTermsDays]);

  const creditLimitInt = useMemo(() => {
    const v = creditLimit.trim();
    if (!v) return null;
    const n = Number(v.replace(/\s/g, "").replace(/,/g, "."));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.trunc(n);
  }, [creditLimit]);

  async function load() {
    setLoading(true);
    setErrList(null);
    try {
      const params = new URLSearchParams({ status, limit: "100" });
      if (q.trim()) params.set("q", q.trim());
      const res = await apiGet<{ items: Client[] }>(`/clients?${params}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErrList(getErrMsg(e, "Erreur lors du chargement"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ✅ Recherche avec debounce — plus de bouton "OK"
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function resetForm() {
    setName("");
    setContactName("");
    setPhone("");
    setTaxId("");
    setPaymentTermsDays("");
    setCreditLimit("");
    setErrForm(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrForm(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ item: Client }>("/clients", {
        name: name.trim(),
        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        taxId: taxId.trim() || null,
        paymentTermsDays: paymentTermsDaysInt,
        creditLimit: creditLimitInt,
      });
      // ✅ Message de succès explicite
      setSuccess(`Client "${res.item?.name ?? name.trim()}" créé.`);
      resetForm();
      await load();
    } catch (e: unknown) {
      setErrForm(getErrMsg(e, "Erreur lors de la création"));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus(c: Client) {
    setUpdatingId(c.id);
    setErrList(null);
    try {
      await apiFetch<{ item: Client }>(`/clients/${c.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      await load();
    } catch (e: unknown) {
      setErrList(getErrMsg(e, "Erreur lors de la mise à jour du statut"));
    } finally {
      setUpdatingId(null);
    }
  }

  async function onDelete(c: Client) {
    setRemovingId(c.id);
    setErrList(null);
    try {
      await apiDelete<{ item: Client }>(`/clients/${c.id}`);
      setConfirmDeleteId(null);
      await load();
    } catch (e: unknown) {
      setErrList(getErrMsg(e, "Erreur lors de la suppression"));
    } finally {
      setRemovingId(null);
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
          Ajouter un client
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maquis Le Plateau"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Contact <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="M. Koffi"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Téléphone <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07 00 00 00 00"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-3">
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

          <div className="md:col-span-2">
            {/* ✅ Label complet — plus de "Délais (j)" tronqué */}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Délai de paiement <span className="font-normal text-slate-400">(jours)</span>
            </label>
            <input
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Plafond crédit <span className="font-normal text-slate-400">(FCFA)</span>
            </label>
            <input
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              inputMode="numeric"
              placeholder="0"
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
          {/* ✅ CTA clair + désactivé si invalide */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {/* ✅ "Création…" avec ellipse correcte */}
            {saving ? "Création…" : "Ajouter le client"}
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
            {loading ? "Chargement…" : `${items.length} client${items.length > 1 ? "s" : ""}`}
          </div>

          {/* ✅ Recherche avec debounce — bouton "OK" supprimé */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (nom, téléphone…)"
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="all">Tous</option>
          </select>

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
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {q.trim() ? "Aucun client ne correspond." : "Aucun client."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Téléphone</th>
                  {/* ✅ Unité dans l'en-tête colonne */}
                  <th className="px-4 py-3">Délai paiement</th>
                  <th className="px-4 py-3">Plafond crédit</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.id}
                    // ✅ Ligne cliquable — navigation directe vers la fiche client
                    onClick={() => router.push(`/app/clients/${c.id}`)}
                    className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {c.contactName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {/* ✅ Unité "j" dans la cellule */}
                      {typeof c.paymentTermsDays === "number" ? `${c.paymentTermsDays} j` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                      {typeof c.creditLimit === "number" ? formatXOF(c.creditLimit) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          c.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
                        }`}
                      >
                        {c.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div
                        className="inline-flex items-center gap-2"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {/* ✅ Busy label explicite — plus de "..." */}
                        <button
                          type="button"
                          onClick={() => onToggleStatus(c)}
                          disabled={updatingId === c.id || removingId === c.id}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                            c.isActive
                              ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                              : "bg-slate-900 text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
                          }`}
                        >
                          {updatingId === c.id ? "Mise à jour…" : c.isActive ? "Désactiver" : "Réactiver"}
                        </button>

                        {/* ✅ Confirmation inline — plus de window.confirm ni tooltip "soft delete" */}
                        {confirmDeleteId === c.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              onClick={() => onDelete(c)}
                              disabled={removingId === c.id}
                            >
                              {removingId === c.id ? "Suppression…" : "Confirmer"}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(c.id)}
                            disabled={updatingId === c.id}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/30"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
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