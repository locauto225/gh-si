export default function AppHomePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Tableau de bord</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        V1 — on commence par Produits, Clients, Stock, Commandes.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="text-sm font-medium">Prochain écran</div>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Va dans <span className="font-medium">Produits</span> pour ajouter les premiers articles.
        </div>
      </div>
    </div>
  );
}