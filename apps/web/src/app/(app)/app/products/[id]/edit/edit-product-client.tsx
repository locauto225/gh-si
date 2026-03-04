"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useAsyncTask } from "@/hooks/use-async-task";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

type SubCategory = { id: string; name: string; slug: string; categoryId?: string | null };
type Category = { id: string; name: string; slug: string; subcategories?: SubCategory[] };
type SupplierListItem = { id: string; name: string };
type WeightUnit = "g" | "kg";
type VolumeUnit = "ml" | "cl" | "l";

type ProductPackaging = {
  id?: string;
  name: string;
  units: number;
  barcode?: string | null;
  grossWeightGr?: number | null;
  tareWeightGr?: number | null;
};
type ProductSupplierLink = {
  id?: string;
  supplierId: string;
  supplierSku?: string | null;
  lastUnitPrice?: number | null;
  packagingId?: string | null;
};

type ProductItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price?: number | null;
  purchasePrice?: number | null;
  isActive: boolean;

  categoryId?: string | null;
  category?: Category | null;
  imageUrl?: string | null;
  weightGr?: number | null;
  volumeMl?: number | null;

  packagings?: ProductPackaging[];
  suppliers?: ProductSupplierLink[];
  subCategories?: { subCategory: SubCategory }[];

  barcode?: string | null;
};

type ColisageRow = {
  name: string;
  customName: string;
  units: number;
  refIdx: number | null;
  barcode: string;
  grossWeightGr: string;
  tareWeightGr: string;
  grossWeightAuto: boolean;
};

function getErrMsg(e: unknown, fallback = "Erreur"): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

const COMMON_UNITS = [
  "bouteille",
  "canette",
  "pack",
  "carton",
  "caisse",
  "bidon",
  "fût",
  "palette",
  "sac",
  "unité",
];

function toIntOrNull(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toOptionalNonNegativeInt(v: string): number | undefined {
  const s = v.trim();
  if (!s) return undefined;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function toWeightGrFromUi(v: string, u: WeightUnit): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  const factor = u === "kg" ? 1000 : 1;
  return Math.trunc(n * factor);
}

function toVolumeMlFromUi(v: string, u: VolumeUnit): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  const factor = u === "l" ? 1000 : u === "cl" ? 10 : 1;
  return Math.trunc(n * factor);
}

function formatDecimal(v: number): string {
  return v.toFixed(3).replace(/\.?0+$/, "");
}

function formatMassAuto(gr: number): string {
  const n = Math.trunc(Number(gr) || 0);
  if (n <= 0) return "0 g";
  if (n >= 1000) return `${formatDecimal(n / 1000)} kg`;
  return `${n} g`;
}

function computeBaseUnits(rows: ColisageRow[], idx: number): number {
  const row = rows[idx];
  if (row.refIdx === null) return row.units;
  return row.units * computeBaseUnits(rows, row.refIdx);
}

export default function EditProductClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [item, setItem] = useState<ProductItem | null>(null);

  // Lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliersList, setSuppliersList] = useState<SupplierListItem[]>([]);

  // Catégorie / sous-catégories (création inline)
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const [isAddingSubCat, setIsAddingSubCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState("");
  const [savingSubCat, setSavingSubCat] = useState(false);

  // Form state
  const [sku, setSku] = useState(""); // read-only en edit
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTask = useAsyncTask();
  const uploadTask = useAsyncTask();
  const saving = saveTask.loading;
  const uploadingImage = uploadTask.loading;

  const [unit, setUnit] = useState("bouteille");
  const [weightValue, setWeightValue] = useState<string>("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("g");
  const [volumeValue, setVolumeValue] = useState<string>("");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>("ml");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subCategoryIds, setSubCategoryIds] = useState<string[]>([]);

  const [purchasePriceXof, setPurchasePriceXof] = useState<string>("");

  const [isActive, setIsActive] = useState(true);

  const [packagingRows, setPackagingRows] = useState<ColisageRow[]>([]);
  const [suppliers, setSuppliers] = useState<ProductSupplierLink[]>([]);
  const initialSnapshotRef = useRef<string>("");

  const currentCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const lowestSupplierPrice = useMemo(() => {
    const prices = suppliers
      .map((s) => s.lastUnitPrice)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
      .map((v) => Math.trunc(v));
    if (!prices.length) return null;
    return Math.min(...prices);
  }, [suppliers]);
  const hasSupplierWithoutPrice = useMemo(
    () =>
      suppliers.some(
        (s) =>
          Boolean(s.supplierId) &&
          !(typeof s.lastUnitPrice === "number" && Number.isFinite(s.lastUnitPrice) && s.lastUnitPrice > 0)
      ),
    [suppliers]
  );

  function computeExpectedGrossWeight(rows: ColisageRow[], idx: number): number | undefined {
    const row = rows[idx];
    if (!row || row.refIdx === null) return undefined;
    const parent = rows[row.refIdx];
    if (!parent) return undefined;
    const parentGross = toOptionalNonNegativeInt(parent.grossWeightGr);
    if (parentGross === undefined) return undefined;
    return row.units * parentGross;
  }

  function syncAutoGrossWeights(rows: ColisageRow[]): ColisageRow[] {
    const next = [...rows];
    let changed = false;

    for (let idx = 0; idx < next.length; idx += 1) {
      const row = next[idx];
      if (!row.grossWeightAuto || row.refIdx === null) continue;
      const expected = computeExpectedGrossWeight(next, idx);
      if (expected === undefined) continue;
      const expectedStr = String(expected);
      if (row.grossWeightGr === expectedStr) continue;
      next[idx] = { ...row, grossWeightGr: expectedStr };
      changed = true;
    }

    return changed ? next : rows;
  }

  function getGrossWeightWarning(row: ColisageRow, idx: number): string | null {
    if (row.refIdx === null) return null;
    const grossGr = toOptionalNonNegativeInt(row.grossWeightGr);
    const expected = computeExpectedGrossWeight(packagingRows, idx);
    if (grossGr === undefined || expected === undefined || expected <= 0) return null;

    const diff = Math.abs(grossGr - expected);
    const ratio = diff / expected;
    if (ratio >= 0.35 && diff >= 100) {
      return `Incohérence poids: attendu ~${formatMassAuto(expected)}`;
    }
    return null;
  }

  function fixGrossWeightAtIndex(idx: number) {
    setPackagingRows((prev) => {
      if (!prev[idx]) return prev;
      const expected = computeExpectedGrossWeight(prev, idx);
      if (expected === undefined) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], grossWeightGr: String(expected), grossWeightAuto: true };
      return next;
    });
  }

  // Appliquer le prix d'une ligne à toutes les lignes
  function applySupplierPriceToAll(fromIdx: number) {
    const from = suppliers[fromIdx];
    const price = from?.lastUnitPrice;
    if (price === null || price === undefined) return;

    setSuppliers((prev) => prev.map((row, i) => (i === fromIdx ? row : { ...row, lastUnitPrice: price })));
  }

  // Appliquer le prix de référence uniquement aux prix fournisseurs vides
  function applyReferencePriceToEmptySupplierPrices() {
    const ref = Math.trunc(Number(purchasePriceXof) || 0);
    if (!ref) return;

    setSuppliers((prev) =>
      prev.map((row) => {
        if (row.lastUnitPrice === null || row.lastUnitPrice === undefined) {
          return { ...row, lastUnitPrice: ref };
        }
        return row;
      })
    );
  }

  function computeExpectedGrossWeightFromUnit(
    rows: ColisageRow[],
    idx: number,
    unitWeightGr: number | undefined
  ): number | undefined {
    const row = rows[idx];
    if (!row) return undefined;

    if (row.refIdx === null) {
      if (!unitWeightGr || unitWeightGr <= 0) return undefined;
      return row.units * unitWeightGr;
    }

    const parent = rows[row.refIdx];
    if (!parent) return undefined;
    const parentGross = toOptionalNonNegativeInt(parent.grossWeightGr);
    if (parentGross === undefined) return undefined;
    return row.units * parentGross;
  }

  function applyUnitWeightToEmptyPackagings() {
    const unitWeightGr = toWeightGrFromUi(weightValue, weightUnit);
    if (!unitWeightGr || unitWeightGr <= 0) return;

    setPackagingRows((prev) => {
      const next = [...prev];
      let changed = false;
      for (let idx = 0; idx < next.length; idx += 1) {
        const row = next[idx];
        const gross = computeExpectedGrossWeightFromUnit(next, idx, unitWeightGr);
        if (gross === undefined) continue;
        const grossStr = String(gross);
        if (row.grossWeightGr !== grossStr || !row.grossWeightAuto) {
          next[idx] = { ...row, grossWeightGr: grossStr, grossWeightAuto: true };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  async function refreshCategories() {
    try {
      const res = await apiGet<{ items: Category[] }>("/categories?includeSubcategories=true");
      setCategories(res.items ?? []);
    } catch {
      setCategories([]);
    }
  }

  async function refreshSuppliers() {
    try {
      const res = await apiGet<{ items: SupplierListItem[] }>("/suppliers/list");
      setSuppliersList(res.items ?? []);
    } catch {
      try {
        const res2 = await apiGet<{ items: SupplierListItem[] }>("/suppliers?limit=200");
        setSuppliersList(res2.items ?? []);
      } catch {
        setSuppliersList([]);
      }
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    setErr(null);

    try {
      const res = await apiPost<{ item: Category }>("/categories", { name: newCatName.trim() });
      const newCat = res.item;

      await refreshCategories();
      setCategoryId(newCat.id);

      setNewCatName("");
      setIsAddingCat(false);
      setSubCategoryIds([]);
    } catch (e) {
      setErr(getErrMsg(e, "Erreur création catégorie"));
    } finally {
      setSavingCat(false);
    }
  }

  async function handleAddSubCategory() {
    if (!newSubCatName.trim() || !categoryId) return;
    setSavingSubCat(true);
    setErr(null);

    try {
      const res = await apiPost<{ item: SubCategory }>(`/categories/${categoryId}/subcategories`, {
        name: newSubCatName.trim(),
      });

      const newSc = res.item;
      await refreshCategories();
      setSubCategoryIds((prev) => [...prev, newSc.id]);

      setNewSubCatName("");
      setIsAddingSubCat(false);
    } catch (e) {
      setErr(getErrMsg(e, "Erreur création sous-catégorie"));
    } finally {
      setSavingSubCat(false);
    }
  }

  async function handleDeleteCategory(catId: string, catName: string) {
    if (!confirm(`Supprimer la catégorie "${catName}" et toutes ses sous-catégories ?`)) return;
    setErr(null);

    try {
      await apiDelete(`/categories/${catId}`);
      await refreshCategories();

      if (categoryId === catId) {
        setCategoryId("");
        setSubCategoryIds([]);
      }
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur suppression catégorie"));
    }
  }

  async function handleDeleteSubcategory(catId: string, subId: string, subName: string) {
    if (!confirm(`Supprimer la sous-catégorie "${subName}" ?`)) return;
    setErr(null);

    try {
      await apiDelete(`/categories/${catId}/subcategories/${subId}`);
      await refreshCategories();
      setSubCategoryIds((prev) => prev.filter((x) => x !== subId));
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur suppression sous-catégorie"));
    }
  }

  function makeSnapshot(input: {
    name: string;
    barcode: string;
    imageUrl: string;
    unit: string;
    weightValue: string;
    weightUnit: WeightUnit;
    volumeValue: string;
    volumeUnit: VolumeUnit;
    categoryId: string;
    subCategoryIds: string[];
    purchasePriceXof: string;
    isActive: boolean;
    packagingRows: ColisageRow[];
    suppliers: ProductSupplierLink[];
  }) {
    return JSON.stringify({
      name: input.name.trim(),
      barcode: input.barcode.trim(),
      imageUrl: input.imageUrl.trim(),
      unit: input.unit.trim(),
      weightValue: input.weightValue.trim(),
      weightUnit: input.weightUnit,
      volumeValue: input.volumeValue.trim(),
      volumeUnit: input.volumeUnit,
      categoryId: input.categoryId || "",
      subCategoryIds: [...input.subCategoryIds].sort(),
      purchasePriceXof: input.purchasePriceXof.trim(),
      isActive: input.isActive,
      packagingRows: input.packagingRows.map((r) => ({
        name: r.name,
        customName: r.customName,
        units: r.units,
        refIdx: r.refIdx,
        barcode: r.barcode.trim(),
        grossWeightGr: r.grossWeightGr.trim(),
        tareWeightGr: r.tareWeightGr.trim(),
        grossWeightAuto: r.grossWeightAuto,
      })),
      suppliers: input.suppliers.map((s) => ({
        id: s.id ?? "",
        supplierId: s.supplierId,
        supplierSku: (s.supplierSku ?? "").trim(),
        lastUnitPrice:
          typeof s.lastUnitPrice === "number" &&
          Number.isFinite(s.lastUnitPrice) &&
          s.lastUnitPrice > 0
            ? Math.trunc(s.lastUnitPrice)
            : null,
        packagingId: s.packagingId ?? "",
      })),
    });
  }

  function hydrateForm(p: ProductItem) {
    setSku(p.sku ?? "");
    setName(p.name ?? "");
    setBarcode((p as any).barcode ?? "");
    setImageUrl(p.imageUrl ?? "");

    setUnit(p.unit ?? "bouteille");
    const rawWeightGr = Number(p.weightGr);
    if (Number.isFinite(rawWeightGr) && rawWeightGr >= 0) {
      if (rawWeightGr >= 1000) {
        setWeightUnit("kg");
        setWeightValue(formatDecimal(rawWeightGr / 1000));
      } else {
        setWeightUnit("g");
        setWeightValue(String(Math.trunc(rawWeightGr)));
      }
    } else {
      setWeightUnit("g");
      setWeightValue("");
    }

    const rawVolumeMl = Number(p.volumeMl);
    if (Number.isFinite(rawVolumeMl) && rawVolumeMl >= 0) {
      if (rawVolumeMl >= 1000) {
        setVolumeUnit("l");
        setVolumeValue(formatDecimal(rawVolumeMl / 1000));
      } else if (Number.isInteger(rawVolumeMl) && rawVolumeMl >= 100 && rawVolumeMl % 10 === 0) {
        setVolumeUnit("cl");
        setVolumeValue(formatDecimal(rawVolumeMl / 10));
      } else {
        setVolumeUnit("ml");
        setVolumeValue(String(Math.trunc(rawVolumeMl)));
      }
    } else {
      setVolumeUnit("ml");
      setVolumeValue("");
    }
    setIsActive(Boolean(p.isActive));

    setCategoryId(p.categoryId ?? "");
    const scIds =
      p.subCategories?.map((x) => x?.subCategory?.id).filter((x): x is string => Boolean(x)) ?? [];
    setSubCategoryIds(scIds);

    setPurchasePriceXof(p.purchasePrice != null ? String(Math.trunc(p.purchasePrice)) : "");

    // Colisages : on hydrate “plat” (refIdx null) car l’API ne stocke pas la hiérarchie.
    setPackagingRows(
      (p.packagings ?? []).map((pg) => ({
        name: pg.name ?? "carton",
        customName: "",
        units: Math.trunc(Number(pg.units) || 1),
        refIdx: null,
        barcode: (pg.barcode ?? "") as string,
        grossWeightGr:
          pg.grossWeightGr == null ? "" : String(Math.trunc(Number(pg.grossWeightGr) || 0)),
        tareWeightGr: pg.tareWeightGr == null ? "" : String(Math.trunc(Number(pg.tareWeightGr) || 0)),
        grossWeightAuto: false,
      }))
    );

    const hydratedSuppliers = p.suppliers ?? [];
    setSuppliers(hydratedSuppliers);

    initialSnapshotRef.current = makeSnapshot({
      name: p.name ?? "",
      barcode: (p as any).barcode ?? "",
      imageUrl: p.imageUrl ?? "",
      unit: p.unit ?? "bouteille",
      weightValue:
        Number.isFinite(Number(p.weightGr)) && Number(p.weightGr) >= 0
          ? Number(p.weightGr) >= 1000
            ? formatDecimal(Number(p.weightGr) / 1000)
            : String(Math.trunc(Number(p.weightGr)))
          : "",
      weightUnit:
        Number.isFinite(Number(p.weightGr)) && Number(p.weightGr) >= 1000
          ? "kg"
          : "g",
      volumeValue:
        Number.isFinite(Number(p.volumeMl)) && Number(p.volumeMl) >= 0
          ? Number(p.volumeMl) >= 1000
            ? formatDecimal(Number(p.volumeMl) / 1000)
            : Number.isInteger(Number(p.volumeMl)) &&
                Number(p.volumeMl) >= 100 &&
                Number(p.volumeMl) % 10 === 0
              ? formatDecimal(Number(p.volumeMl) / 10)
              : String(Math.trunc(Number(p.volumeMl)))
          : "",
      volumeUnit:
        Number.isFinite(Number(p.volumeMl)) && Number(p.volumeMl) >= 1000
          ? "l"
          : Number.isInteger(Number(p.volumeMl)) &&
              Number(p.volumeMl) >= 100 &&
              Number(p.volumeMl) % 10 === 0
            ? "cl"
            : "ml",
      categoryId: p.categoryId ?? "",
      subCategoryIds: scIds,
      purchasePriceXof: p.purchasePrice != null ? String(Math.trunc(p.purchasePrice)) : "",
      isActive: Boolean(p.isActive),
      packagingRows: (p.packagings ?? []).map((pg) => ({
        name: pg.name ?? "carton",
        customName: "",
        units: Math.trunc(Number(pg.units) || 1),
        refIdx: null,
        barcode: (pg.barcode ?? "") as string,
        grossWeightGr:
          pg.grossWeightGr == null ? "" : String(Math.trunc(Number(pg.grossWeightGr) || 0)),
        tareWeightGr: pg.tareWeightGr == null ? "" : String(Math.trunc(Number(pg.tareWeightGr) || 0)),
        grossWeightAuto: false,
      })),
      suppliers: hydratedSuppliers,
    });
  }

  async function load() {
    if (!id) return;

    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: ProductItem }>(`/products/${id}`);
      setItem(res.item);
      hydrateForm(res.item);
    } catch (e) {
      setItem(null);
      setErr(getErrMsg(e, "Impossible de charger le produit"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshCategories();
    void refreshSuppliers();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currentSnapshot = useMemo(
    () =>
      makeSnapshot({
        name,
        barcode,
        imageUrl,
        unit,
        weightValue,
        weightUnit,
        volumeValue,
        volumeUnit,
        categoryId,
        subCategoryIds,
        purchasePriceXof,
        isActive,
        packagingRows,
        suppliers,
      }),
    [
      barcode,
      categoryId,
      imageUrl,
      isActive,
      name,
      packagingRows,
      purchasePriceXof,
      subCategoryIds,
      suppliers,
      unit,
      volumeUnit,
      volumeValue,
      weightUnit,
      weightValue,
    ]
  );

  const isDirty = useMemo(() => {
    if (loading) return false;
    if (!initialSnapshotRef.current) return false;
    return currentSnapshot !== initialSnapshotRef.current;
  }, [currentSnapshot, loading]);

  useUnsavedChangesGuard({
    when: isDirty && !saving,
    message: "Des modifications non enregistrées seront perdues. Continuer ?",
  });

  // UX: si la catégorie change, on nettoie les sous-catégories qui ne sont plus valides
  useEffect(() => {
    if (!categoryId) {
      setSubCategoryIds([]);
      return;
    }
    const validSet = new Set((currentCategory?.subcategories ?? []).map((sc) => sc.id));
    setSubCategoryIds((prev) => prev.filter((x) => validSet.has(x)));
  }, [categoryId, currentCategory]);

  function normalizeWeightUiUnit() {
    const n = Number(weightValue);
    if (!Number.isFinite(n) || n < 0) return;
    if (weightUnit === "kg" && n > 0 && n < 1) {
      setWeightUnit("g");
      setWeightValue(formatDecimal(n * 1000));
      return;
    }
    if (weightUnit === "g" && n >= 1000) {
      setWeightUnit("kg");
      setWeightValue(formatDecimal(n / 1000));
    }
  }

  function normalizeVolumeUiUnit() {
    const n = Number(volumeValue);
    if (!Number.isFinite(n) || n < 0) return;

    if (volumeUnit === "ml") {
      if (n >= 1000) {
        setVolumeUnit("l");
        setVolumeValue(formatDecimal(n / 1000));
        return;
      }
      if (Number.isInteger(n) && n >= 100 && n % 10 === 0) {
        setVolumeUnit("cl");
        setVolumeValue(formatDecimal(n / 10));
      }
      return;
    }

    if (volumeUnit === "l" && n > 0 && n < 1) {
      setVolumeUnit("cl");
      setVolumeValue(formatDecimal(n * 100));
      return;
    }

    if (volumeUnit === "cl" && n > 0 && n < 1) {
      setVolumeUnit("ml");
      setVolumeValue(formatDecimal(n * 10));
      return;
    }

    if (volumeUnit === "cl" && n >= 100) {
      setVolumeUnit("l");
      setVolumeValue(formatDecimal(n / 100));
    }
  }

  // --- Cloudinary upload signé (Edit only) ---
  async function signCloudinary() {
    return (await apiPost("/uploads/cloudinary/sign", {
      folder: "products",
      publicId: id ? `product_${id}` : undefined,
      overwrite: true,
    })) as {
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
      publicId: string | null;
      overwrite: boolean;
    };
  }

  async function uploadToCloudinary(file: File) {
    const { cloudName, apiKey, timestamp, signature, folder, publicId, overwrite } =
      await signCloudinary();

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder", folder);
    if (publicId) form.append("public_id", publicId);
    form.append("overwrite", overwrite ? "true" : "false");

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const upRes = await fetch(uploadUrl, { method: "POST", body: form });
    const upJson: any = await upRes.json().catch(() => null);

    if (!upRes.ok) {
      const msg = upJson?.error?.message || `Upload Cloudinary failed (${upRes.status})`;
      throw new Error(msg);
    }

    const secureUrl = upJson?.secure_url as string | undefined;
    if (!secureUrl) throw new Error("Upload OK mais secure_url manquant");
    return secureUrl;
  }

  async function onPickImage(e?: React.ChangeEvent<HTMLInputElement>) {
    const file = e?.target?.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    setErr(null);

    try {
      await uploadTask.run(async () => {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error("Image trop lourde (max 8 Mo)");
        }
        const url = await uploadToCloudinary(file);
        setImageUrl(url);
      });
    } catch (e) {
      setErr(getErrMsg(e, "Upload impossible"));
    }
  }

  async function onSave() {
    if (!id) return;
    if (!name.trim()) {
      setErr("La désignation produit est obligatoire.");
      return;
    }

    setErr(null);

    try {
      await saveTask.run(async () => {
        const payload: any = {
          name: name.trim(),
          unit: unit.trim() || undefined,
          weightGr: toWeightGrFromUi(weightValue, weightUnit),
          volumeMl: toVolumeMlFromUi(volumeValue, volumeUnit),
          isActive,
          categoryId: categoryId || undefined,

          // ✅ Photo produit (optionnelle)
          // null = suppression explicite côté API
          imageUrl: imageUrl.trim() ? imageUrl.trim() : null,

          // Achat : si prix fournisseurs existent, on envoie le plus bas (Option B)
          purchasePrice: (lowestSupplierPrice ?? toIntOrNull(purchasePriceXof)) ?? undefined,

          subCategoryIds,

          // packagings (colisage) — même logique que New
          packagings: packagingRows.map((r, idx) => ({
            name: r.name === "Autre…" ? (r.customName || "Autre") : r.name,
            units: computeBaseUnits(packagingRows, idx),
            barcode: r.barcode.trim() || undefined,
            grossWeightGr: toOptionalNonNegativeInt(r.grossWeightGr),
            tareWeightGr: toOptionalNonNegativeInt(r.tareWeightGr),
          })),

          // suppliers (ne pas envoyer supplierSku vide)
          suppliers: suppliers
            .filter((s) => s.supplierId)
            .map((s) => ({
              id: s.id,
              supplierId: s.supplierId,
              supplierSku: s.supplierSku?.trim() ? s.supplierSku.trim() : undefined,
              lastUnitPrice:
                typeof s.lastUnitPrice === "number" &&
                Number.isFinite(s.lastUnitPrice) &&
                s.lastUnitPrice > 0
                  ? Math.trunc(s.lastUnitPrice)
                  : undefined,
              packagingId: s.packagingId?.trim() ? s.packagingId.trim() : undefined,
            })),
        };

        if (barcode.trim()) payload.barcode = barcode.trim();

        await apiPut(`/products/${id}`, payload);

        router.push(`/app/products/${id}`);
        router.refresh();
      });
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Impossible d'enregistrer"));
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          Chargement…
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-16 space-y-3">
        <Link href="/app/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour aux produits
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          Produit introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 transition-all"
          disabled={saving}
        >
          {saving ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"
              />
              Enregistrement…
            </>
          ) : (
            "Enregistrer"
          )}
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* LEFT: main */}
        <div className="lg:col-span-2 space-y-8">
          {/* SECTION 1: IDENTITÉ */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                01
              </span>
              <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                Identité du produit
              </h2>
            </div>

            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="grid gap-6 md:grid-cols-[128px_1fr] items-start">
              {/* Photo (Edit only) */}
              <div className="flex flex-col items-start gap-2">
                <div className="relative w-32 h-32 rounded-2xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] overflow-hidden flex items-center justify-center">
                  {imageUrl ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="block h-full w-full"
                      title="Changer la photo"
                      disabled={uploadingImage || saving}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={name || "Photo produit"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative h-full w-full overflow-hidden bg-[radial-gradient(80%_80%_at_50%_20%,color-mix(in_oklab,var(--primary),white_88%),transparent_70%),color-mix(in_oklab,var(--card),var(--background)_24%)]"
                      title="Ajouter une photo"
                      disabled={uploadingImage || saving}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklab,var(--foreground),transparent_94%)_45%,transparent_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1-1.5h5L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
                            <circle cx="12" cy="12.5" r="3.2" />
                          </svg>
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Aucune photo
                        </span>
                      </div>
                    </button>
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[1px]">
                      <span
                        aria-hidden="true"
                        className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Upload...
                      </span>
                    </div>
                  )}
                </div>

                <div className="w-full grid gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickImage}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || saving}
                    className="text-xs font-bold text-muted-foreground hover:text-primary disabled:opacity-50"
                    title={imageUrl ? "Changer la photo" : "Ajouter une photo"}
                  >
                    {imageUrl ? "Changer la photo" : "Ajouter la photo"}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const ok = confirm("Supprimer la photo du produit ?");
                        if (!ok) return;
                        setImageUrl("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      disabled={uploadingImage || saving}
                      className="text-xs font-bold text-muted-foreground hover:text-red-600 disabled:opacity-50"
                    >
                      Supprimer la photo
                    </button>
                  )}
                </div>
              </div>

              {/* Désignation */}
              <div className="min-w-[260px] flex-1 grid gap-4">
                <label className="text-[11px] uppercase font-black text-muted-foreground">
                  Désignation produit <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border-b border-muted py-2 outline-none focus:border-primary transition-colors text-xl font-medium"
                  placeholder="Ex: Eau Minérale 1.5L"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label className="text-[11px] uppercase font-black text-muted-foreground">Référence produit</label>
                    <input
                      value={sku}
                      disabled
                      className="bg-muted/30 px-3 py-2 rounded-lg border text-sm font-mono opacity-80"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-[11px] uppercase font-black text-muted-foreground">Code-barres Unité</label>
                    <input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Scanner..."
                      className="bg-muted/30 px-3 py-2 rounded-lg border text-sm font-mono outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </section>

          {/* SECTION 2: FOURNISSEURS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  02
                </span>
                <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Sources d&apos;achat
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={applyReferencePriceToEmptySupplierPrices}
                  disabled={!purchasePriceXof || Number(purchasePriceXof) <= 0}
                  className="text-[11px] font-black text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title="Appliquer le prix de référence aux prix vides"
                >
                  Appliquer prix de référence
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSuppliers((prev) => [...prev, { supplierId: "", supplierSku: "", lastUnitPrice: null }])
                  }
                  className="text-[11px] font-black text-primary hover:underline"
                >
                  + AJOUTER UN FOURNISSEUR
                </button>
              </div>
            </div>

            {hasSupplierWithoutPrice && (
              <div className="text-xs text-amber-700">
                Au moins un fournisseur n&apos;a pas de prix d&apos;achat, le prix de référence sera utilisé en secours.
              </div>
            )}

            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              {suppliers.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm italic">
                  Aucun fournisseur lié.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b text-[10px] uppercase font-black text-muted-foreground">
                      <th className="px-4 py-3 text-left">Fournisseur</th>
                      <th className="px-4 py-3 text-left">Réf. Fourn.</th>
                      <th className="px-4 py-3 text-left">Prix Achat</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {suppliers.map((s, idx) => (
                      <tr key={idx} className="group">
                        <td className="p-2 px-4">
                          <select
                            value={s.supplierId}
                            onChange={(e) => {
                              const next = [...suppliers];
                              next[idx].supplierId = e.target.value;
                              setSuppliers(next);
                            }}
                            className="w-full bg-transparent text-sm outline-none font-medium"
                          >
                            <option value="">Choisir...</option>
                            {suppliersList.map((sup) => (
                              <option key={sup.id} value={sup.id}>
                                {sup.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 px-4">
                          <input
                            value={s.supplierSku ?? ""}
                            onChange={(e) => {
                              const next = [...suppliers];
                              next[idx].supplierSku = e.target.value;
                              setSuppliers(next);
                            }}
                            className="w-full bg-transparent text-sm font-mono outline-none"
                            placeholder="---"
                          />
                        </td>

                        <td className="p-2 px-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={s.lastUnitPrice ?? ""}
                              onChange={(e) => {
                                const next = [...suppliers];
                                const v = e.target.value;
                                if (v === "") {
                                  next[idx].lastUnitPrice = null;
                                } else {
                                  const n = Number(v);
                                  next[idx].lastUnitPrice = Number.isFinite(n) && n > 0 ? n : null;
                                }
                                setSuppliers(next);
                              }}
                              placeholder="—"
                              className="w-24 bg-transparent text-sm font-bold text-primary outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => applySupplierPriceToAll(idx)}
                              disabled={s.lastUnitPrice === null || s.lastUnitPrice === undefined}
                              className="text-muted hover:text-primary disabled:opacity-40 transition-colors"
                              title="Appliquer ce prix à tous les fournisseurs"
                              aria-label="Appliquer ce prix à tous les fournisseurs"
                            >
                              ⇄
                            </button>
                          </div>
                        </td>

                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSuppliers((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-muted hover:text-red-500 transition-colors"
                            title="Retirer"
                            aria-label="Retirer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* SECTION 3: COLISAGES */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  03
                </span>
                <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Unités &amp; colisages
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPackagingRows((prev) =>
                    syncAutoGrossWeights([
                      ...prev,
                      {
                        name: "carton",
                        customName: "",
                        units: 6,
                        refIdx: null,
                        barcode: "",
                        grossWeightGr: "",
                        tareWeightGr: "",
                        grossWeightAuto: true,
                      },
                    ])
                  )
                }
                className="text-[11px] font-black text-primary hover:underline"
              >
                + AJOUTER UN FORMAT
              </button>
            </div>

            {packagingRows.length === 0 ? (
              <div className="bg-card border-2 border-dashed rounded-2xl p-8 text-center text-muted-foreground text-sm">
                Ce produit ne se vend qu&apos;à l&apos;unité de base ({unit}).
              </div>
            ) : (
              <div className="space-y-3">
                {packagingRows.map((row, idx) => {
                  const grossWeightWarning = getGrossWeightWarning(row, idx);
                  const grossWeightValue = toOptionalNonNegativeInt(row.grossWeightGr);
                  const tareWeightValue = toOptionalNonNegativeInt(row.tareWeightGr);
                  const netWeightValue =
                    grossWeightValue !== undefined && tareWeightValue !== undefined
                      ? grossWeightValue - tareWeightValue
                      : undefined;
                  return (
                    <div
                      key={idx}
                      className="bg-card border rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-sm relative group"
                    >
                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl border">
                      <span className="text-[10px] font-bold text-muted-foreground">1</span>
                      <select
                        value={row.name}
                        onChange={(e) => {
                          const next = [...packagingRows];
                          next[idx].name = e.target.value;
                          setPackagingRows(syncAutoGrossWeights(next));
                        }}
                        className="bg-transparent font-bold text-sm outline-none"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="font-bold text-primary">=</span>

                    <div className="flex items-center gap-2 bg-primary/5 px-3 py-2 rounded-xl border border-primary/20">
                      <input
                        type="number"
                        value={row.units === 0 ? "" : row.units}
                        onChange={(e) => {
                          const next = [...packagingRows];
                          next[idx].units = Number(e.target.value);
                          setPackagingRows(syncAutoGrossWeights(next));
                        }}
                        className="w-12 bg-transparent text-center font-black text-primary outline-none"
                      />
                      <select
                        value={row.refIdx === null ? "__base__" : String(row.refIdx)}
                        onChange={(e) => {
                          const next = [...packagingRows];
                          next[idx].refIdx = e.target.value === "__base__" ? null : Number(e.target.value);
                          setPackagingRows(syncAutoGrossWeights(next));
                        }}
                        className="text-xs font-bold text-primary/70 bg-transparent outline-none"
                      >
                        <option value="__base__">{unit}(s)</option>
                        {packagingRows.slice(0, idx).map((r, i) => (
                          <option key={i} value={String(i)}>
                            {r.name}(s)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 flex flex-wrap items-end justify-between gap-4 md:gap-6 md:flex-nowrap">
                      <div className="hidden md:grid grid-cols-2 gap-3 items-end min-w-[320px] shrink-0">
                        <div>
                          <label className="text-[9px] uppercase font-black text-muted-foreground block text-right whitespace-nowrap">
                            Poids total du colis (g)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={row.grossWeightGr}
                            onChange={(e) => {
                              const next = [...packagingRows];
                              next[idx].grossWeightGr = e.target.value;
                              next[idx].grossWeightAuto = false;
                              setPackagingRows(syncAutoGrossWeights(next));
                            }}
                            placeholder="—"
                            className="text-right bg-transparent text-sm font-mono outline-none w-24"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-black text-muted-foreground block text-right whitespace-nowrap">
                            Tare du colis (g)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={row.tareWeightGr}
                            onChange={(e) => {
                              const next = [...packagingRows];
                              next[idx].tareWeightGr = e.target.value;
                              setPackagingRows(next);
                            }}
                            placeholder="—"
                            className="text-right bg-transparent text-sm font-mono outline-none w-20"
                          />
                        </div>
                        {netWeightValue !== undefined && (
                          <div className="col-span-2 text-right text-[10px] font-bold text-muted-foreground pt-1">
                            {netWeightValue >= 0
                              ? `Poids net du produit (g): ${netWeightValue}`
                              : "Poids net du produit (g): incohérent"}
                          </div>
                        )}
                      </div>

                      {grossWeightWarning && (
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-bold text-amber-600 whitespace-nowrap">
                            {grossWeightWarning}
                          </div>
                          <button
                            type="button"
                            onClick={() => fixGrossWeightAtIndex(idx)}
                            className="text-[10px] font-black text-amber-700 hover:text-amber-800 underline underline-offset-2"
                            title="Corriger automatiquement le poids total"
                          >
                            Corriger
                          </button>
                        </div>
                      )}

                      <div className="hidden md:flex items-end gap-4 ml-auto shrink-0">
                        <div>
                          <label className="text-[9px] uppercase font-black text-muted-foreground block whitespace-nowrap">
                            Code-barres Lot
                          </label>
                          <input
                            value={row.barcode}
                            onChange={(e) => {
                              const next = [...packagingRows];
                              next[idx].barcode = e.target.value;
                              setPackagingRows(next);
                            }}
                            placeholder="Scanner..."
                            className="bg-transparent text-sm font-mono outline-none"
                          />
                        </div>

                        <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                          Total: {computeBaseUnits(packagingRows, idx)}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setPackagingRows((prev) => syncAutoGrossWeights(prev.filter((_, i) => i !== idx)))
                          }
                          className="text-muted hover:text-red-500"
                          title="Retirer"
                          aria-label="Retirer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="md:hidden ml-auto flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                          Total: {computeBaseUnits(packagingRows, idx)}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPackagingRows((prev) => syncAutoGrossWeights(prev.filter((_, i) => i !== idx)))
                          }
                          className="text-muted hover:text-red-500"
                          title="Retirer"
                          aria-label="Retirer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: sidebar */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Configuration Stock
              </h3>
            </div>

            <div className="grid gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Unité de base</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-muted/30 border rounded-xl px-4 py-2.5 text-sm font-medium outline-none"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Poids
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={weightValue}
                      onChange={(e) => setWeightValue(e.target.value)}
                      onBlur={normalizeWeightUiUnit}
                      placeholder="Ex: 1.5"
                      className="w-full bg-background/70 border rounded-lg px-3 py-2 text-xs font-medium outline-none"
                    />
                    <select
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
                      className="bg-background/70 border rounded-lg px-2.5 py-2 text-xs font-medium outline-none"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Volume
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={volumeValue}
                      onChange={(e) => setVolumeValue(e.target.value)}
                      onBlur={normalizeVolumeUiUnit}
                      placeholder="Ex: 1.5"
                      className="w-full bg-background/70 border rounded-lg px-3 py-2 text-xs font-medium outline-none"
                    />
                    <select
                      value={volumeUnit}
                      onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}
                      className="bg-background/70 border rounded-lg px-2.5 py-2 text-xs font-medium outline-none"
                    >
                      <option value="ml">ml</option>
                      <option value="cl">cl</option>
                      <option value="l">L</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={applyUnitWeightToEmptyPackagings}
                  disabled={!toWeightGrFromUi(weightValue, weightUnit)}
                  className="text-[10px] font-black text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
                  title="Appliquer le poids unitaire à tous les colisages"
                >
                  Appliquer poids aux colisages
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Prix d&apos;achat</label>

              {lowestSupplierPrice === null ? (
                <>
                  <div className="text-xs text-muted-foreground">
                    Prix de référence utilisé si les prix fournisseurs ne sont pas renseignés.
                  </div>
                  <input
                    value={purchasePriceXof}
                    onChange={(e) => setPurchasePriceXof(e.target.value)}
                    placeholder="0"
                    className="w-full bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 text-lg font-black text-primary outline-none"
                  />
                </>
              ) : (
                <div className="mt-1 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Meilleur prix fournisseur</div>
                  <div className="mt-1 text-lg font-black text-primary">{lowestSupplierPrice} FCFA</div>
                </div>
              )}
            </div>

            {/* Classification (création + suppression) */}
            <div className="pt-4 border-t space-y-4">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Classification</div>

              {/* Catégorie */}
              {isAddingCat ? (
                <div className="flex gap-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddCategory();
                      }
                    }}
                    placeholder="Nom de la catégorie"
                    className="flex-1 bg-card border border-primary/40 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddCategory()}
                    disabled={savingCat || !newCatName.trim()}
                    className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingCat ? "…" : "Créer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCat(false);
                      setNewCatName("");
                    }}
                    className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubCategoryIds([]);
                    }}
                    className="flex-1 bg-muted/30 border rounded-xl px-4 py-2.5 text-sm outline-none"
                  >
                    <option value="">Catégorie…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {categoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        const c = categories.find((c) => c.id === categoryId);
                        if (c) void handleDeleteCategory(c.id, c.name);
                      }}
                      className="rounded-xl border border-border px-2.5 py-2 text-muted hover:text-red-500 hover:border-red-300 transition-colors"
                      title="Supprimer cette catégorie"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsAddingCat(true)}
                    className="rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    + Nouvelle
                  </button>
                </div>
              )}

              {/* Sous-catégories */}
              {categoryId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase font-black text-muted-foreground">Sous-catégories</div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      {subCategoryIds.length} sélectionnée{subCategoryIds.length > 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {currentCategory?.subcategories?.map((sc) => {
                      const selected = subCategoryIds.includes(sc.id);
                      return (
                        <div key={sc.id} className="group flex items-center">
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setSubCategoryIds((prev) =>
                                selected ? prev.filter((x) => x !== sc.id) : [...prev, sc.id]
                              )
                            }
                            className={`px-3 py-1.5 rounded-l-lg text-[10px] font-black uppercase transition-all border ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 shadow-sm"
                                : "bg-muted/20 text-muted-foreground border-border hover:bg-muted-foreground/10"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {selected && (
                                <span
                                  aria-hidden
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-background/20"
                                >
                                  ✓
                                </span>
                              )}
                              <span>{sc.name}</span>
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteSubcategory(categoryId, sc.id, sc.name)}
                            className={`px-1.5 py-1.5 rounded-r-lg border border-l-0 ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted/20 text-muted-foreground"
                            } opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-950/40 transition-all`}
                            title="Supprimer"
                          >
                            <svg
                              className="h-2.5 w-2.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}

                    {!isAddingSubCat && (
                      <button
                        type="button"
                        onClick={() => setIsAddingSubCat(true)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-dashed border-border text-muted hover:text-foreground hover:border-primary/50 transition-colors"
                      >
                        + Nouvelle sous-catégorie
                      </button>
                    )}
                  </div>

                  {isAddingSubCat && (
                    <div className="flex gap-2">
                      <input
                        value={newSubCatName}
                        onChange={(e) => setNewSubCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleAddSubCategory();
                          }
                        }}
                        placeholder="Nom de la sous-catégorie"
                        className="flex-1 bg-card border border-primary/40 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddSubCategory()}
                        disabled={savingSubCat || !newSubCatName.trim()}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {savingSubCat ? "…" : "Créer"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSubCat(false);
                          setNewSubCatName("");
                        }}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actif */}
            <div className="pt-4 border-t">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-6 rounded-full relative transition-colors ${isActive ? "bg-green-500" : "bg-muted"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isActive ? "left-5" : "left-1"}`} />
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => {
                    const next = e.target.checked;
                    const ok = confirm(
                      next
                        ? "Confirmer la réactivation du produit ?"
                        : "Confirmer la désactivation du produit ?"
                    );
                    if (!ok) return;
                    setIsActive(next);
                  }}
                  className="hidden"
                />
                <span className="text-xs font-bold uppercase text-muted-foreground group-hover:text-foreground">
                  Produit actif
                </span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
