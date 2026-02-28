import StoresClient from "./stores-client";

export default function StoresPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Magasins</h1>
          <p className="text-sm text-muted">Crée et gère tes magasins (code, nom, rattachement à un entrepôt).</p>
        </div>
      </div>

      <StoresClient />
    </div>
  );
}