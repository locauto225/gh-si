"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Warehouse,
  Boxes,
  ShoppingCart,
  Receipt,
  ClipboardList,
  FileText,
  CreditCard,
  BadgeCheck,
  Tags,
  Store as StoreIcon,
  Menu,
  Route,
  UserCircle,
  MonitorSmartphone,
} from "lucide-react";

function NavLink({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className={
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 " +
        (active
          ? "bg-orange-500/10 text-orange-100 ring-1 ring-orange-500/15 shadow-[0_0_14px_rgba(249,115,22,0.14)]"
          : "text-slate-200/85 hover:bg-white/8 hover:text-white")
      }
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-orange-500" />
      ) : null}

      <Icon
        className={
          "h-4 w-4 shrink-0 transition-transform duration-200 " +
          (active
            ? "text-orange-300"
            : "text-slate-300/80 group-hover:text-slate-100")
        }
      />

      <span className={active ? "font-medium" : ""}>{label}</span>
    </Link>
  );
}

function NavSection({
  title,
  accent,
  isActive,
  children,
}: {
  title: string;
  accent: "slate" | "orange" | "amber" | "emerald" | "violet";
  isActive: boolean;
  children: ReactNode;
}) {
  const dot =
    accent === "orange"
      ? "bg-orange-500"
      : accent === "amber"
      ? "bg-amber-400"
      : accent === "emerald"
      ? "bg-emerald-400"
      : accent === "violet"
      ? "bg-violet-400"
      : "bg-slate-400";

  const box =
    accent === "orange"
      ? "border-orange-500/20 bg-orange-500/5"
      : accent === "amber"
      ? "border-amber-500/20 bg-amber-500/5"
      : accent === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/5"
      : accent === "violet"
      ? "border-violet-400/20 bg-violet-400/5"
      : "border-slate-400/15 bg-white/5";

  return (
    <div className="mt-4">
      <div
        className={
          "flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-widest " +
          (isActive ? "text-slate-100" : "text-slate-300/80")
        }
      >
        <span className={"h-1.5 w-1.5 rounded-full " + dot} />
        {title}
      </div>
      <div className={"mt-2 rounded-xl border p-1 " + box}>{children}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed left-0 top-0 z-50 h-0.75 w-full bg-linear-to-r from-orange-500 via-orange-400 to-emerald-500" />
      <div className="flex min-h-dvh w-full">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-emerald-950/40 bg-emerald-950 p-4 md:flex md:flex-col">
          <div className="mb-4 border-b border-emerald-950/40 pb-3">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="GROUPE GH"
                width={48}
                height={48}
                className="h-12 w-12"
                priority
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-tight">
                  GH • SI
                </div>
                <div className="text-[11px] text-slate-300/80">
                  Back-office
                </div>
              </div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            <NavSection title="Pilotage" accent="slate" isActive={pathname === "/app/dashboard" || pathname.startsWith("/app/dashboard/")}>
              <NavLink
                href="/app/dashboard"
                label="Tableau de bord"
                icon={LayoutDashboard}
                active={pathname === "/app/dashboard" || pathname.startsWith("/app/dashboard/")}
              />
            </NavSection>

            <NavSection
              title="Dépôt"
              accent="orange"
              isActive={
                pathname.startsWith("/app/orders") ||
                pathname.startsWith("/app/sales") ||
                pathname.startsWith("/app/invoices") ||
                pathname.startsWith("/app/clients")
              }
            >
              <NavLink
                href="/app/orders"
                label="Commandes"
                icon={ClipboardList}
                active={pathname.startsWith("/app/orders") || pathname.startsWith("/app/sales")}
              />
              <NavLink href="/app/invoices" label="Factures" icon={CreditCard} active={pathname.startsWith("/app/invoices")} />
              <NavLink href="/app/clients" label="Clients" icon={Users} active={pathname.startsWith("/app/clients")} />
            </NavSection>

            <NavSection
              title="Logistique"
              accent="emerald"
              isActive={pathname.startsWith("/app/trips") || pathname.startsWith("/app/deliveries") || pathname.startsWith("/app/drivers")}
            >
              <NavLink href="/app/trips" label="Tournées" icon={Route} active={pathname.startsWith("/app/trips")} />
              <NavLink href="/app/deliveries" label="Bons de livraison" icon={FileText} active={pathname.startsWith("/app/deliveries")} />
              <NavLink href="/app/drivers" label="Livreurs" icon={UserCircle} active={pathname.startsWith("/app/drivers")} />
            </NavSection>

            <NavSection
              title="Caisse"
              accent="amber"
              isActive={pathname.startsWith("/app/pos")}
            >
              <NavLink
                href="/app/pos"
                label="Point de vente"
                icon={MonitorSmartphone}
                active={pathname === "/app/pos" || (pathname.startsWith("/app/pos") && !pathname.startsWith("/app/pos/receipts"))}
              />
              <NavLink
                href="/app/pos/receipts"
                label="Tickets"
                icon={Receipt}
                active={pathname.startsWith("/app/pos/receipts")}
              />
            </NavSection>

            <NavSection
              title="Achats"
              accent="amber"
              isActive={
                pathname.startsWith("/app/purchases") ||
                pathname.startsWith("/app/receipts") ||
                pathname.startsWith("/app/suppliers")
              }
            >
              <NavLink href="/app/purchases" label="Achats" icon={ShoppingCart} active={pathname.startsWith("/app/purchases")} />
              <NavLink href="/app/receipts" label="Réceptions" icon={Receipt} active={pathname.startsWith("/app/receipts")} />
              <NavLink href="/app/suppliers" label="Fournisseurs" icon={Truck} active={pathname.startsWith("/app/suppliers")} />
            </NavSection>

            <NavSection
              title="Stock"
              accent="emerald"
              isActive={
                pathname.startsWith("/app/stock") ||
                pathname.startsWith("/app/products") ||
                pathname.startsWith("/app/pricelists") ||
                pathname.startsWith("/app/warehouses") ||
                pathname.startsWith("/app/stores")
              }
            >
              <NavLink href="/app/stock" label="Stock" icon={Boxes} active={pathname.startsWith("/app/stock")} />
              <NavLink href="/app/products" label="Produits" icon={Package} active={pathname.startsWith("/app/products")} />
              <NavLink href="/app/pricelists" label="Tarifs" icon={Tags} active={pathname.startsWith("/app/pricelists")} />
              <NavLink href="/app/warehouses" label="Entrepôts" icon={Warehouse} active={pathname.startsWith("/app/warehouses")} />
              <NavLink href="/app/stores" label="Magasins" icon={StoreIcon} active={pathname.startsWith("/app/stores")} />
            </NavSection>

            <NavSection title="Fiscal" accent="violet" isActive={pathname.startsWith("/app/fiscal")}>
              <NavLink href="/app/fiscal" label="FNE / RNE" icon={BadgeCheck} active={pathname.startsWith("/app/fiscal")} />
            </NavSection>
          </nav>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-emerald-950/40 pt-3">
            <ThemeToggle />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-950/40 bg-white/5 px-2 py-1 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Offline-ready
            </span>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 bg-[color:var(--card)]/90 backdrop-blur md:bg-transparent md:backdrop-blur-0">
            <div>
              {/* Mobile header content */}
              <div className="border-b border-[var(--border)] px-4 py-3 md:hidden">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/logo.png"
                      alt="GROUPE GH"
                      width={40}
                      height={40}
                      className="h-10 w-10"
                      priority
                    />
                    <div className="text-[13px] font-semibold">GH • SI</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileOpen(true)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-slate-700 hover:bg-[var(--card)]/70 dark:text-slate-200"
                      aria-label="Ouvrir le menu"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
              {/* Mobile drawer */}
              {mobileOpen ? (
                <div className="fixed inset-0 z-50 md:hidden">
                  <button
                    type="button"
                    aria-label="Fermer le menu"
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setMobileOpen(false)}
                  />

                  <div className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] border-r border-emerald-950/30 bg-emerald-950 p-4 text-slate-100 shadow-xl">
                    <div className="mb-4 border-b border-emerald-950/40 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Image
                            src="/logo.png"
                            alt="GROUPE GH"
                            width={44}
                            height={44}
                            className="h-11 w-11"
                            priority
                          />
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold tracking-tight">GH • SI</div>
                            <div className="text-[11px] text-slate-300/80">Back-office</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg border border-emerald-950/40 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>

                    <nav className="flex flex-col gap-1" onClick={() => setMobileOpen(false)}>
                      <NavSection title="Pilotage" accent="slate" isActive={pathname === "/app/dashboard" || pathname.startsWith("/app/dashboard/")}>
                        <NavLink
                          href="/app/dashboard"
                          label="Tableau de bord"
                          icon={LayoutDashboard}
                          active={pathname === "/app/dashboard" || pathname.startsWith("/app/dashboard/")}
                        />
                      </NavSection>

                      <NavSection
                        title="Dépôt"
                        accent="orange"
                        isActive={
                          pathname.startsWith("/app/orders") ||
                          pathname.startsWith("/app/sales") ||
                          pathname.startsWith("/app/invoices") ||
                          pathname.startsWith("/app/clients")
                        }
                      >
                        <NavLink
                          href="/app/orders"
                          label="Commandes"
                          icon={ClipboardList}
                          active={pathname.startsWith("/app/orders") || pathname.startsWith("/app/sales")}
                        />
                        <NavLink href="/app/invoices" label="Factures" icon={CreditCard} active={pathname.startsWith("/app/invoices")} />
                        <NavLink href="/app/clients" label="Clients" icon={Users} active={pathname.startsWith("/app/clients")} />
                      </NavSection>

                      <NavSection
                        title="Logistique"
                        accent="emerald"
                        isActive={pathname.startsWith("/app/trips") || pathname.startsWith("/app/deliveries") || pathname.startsWith("/app/drivers")}
                      >
                        <NavLink href="/app/trips" label="Tournées" icon={Route} active={pathname.startsWith("/app/trips")} />
                        <NavLink href="/app/deliveries" label="Bons de livraison" icon={FileText} active={pathname.startsWith("/app/deliveries")} />
                        <NavLink href="/app/drivers" label="Livreurs" icon={UserCircle} active={pathname.startsWith("/app/drivers")} />
                      </NavSection>

                      <NavSection
                        title="Caisse"
                        accent="amber"
                        isActive={pathname.startsWith("/app/pos")}
                      >
                        <NavLink
                          href="/app/pos"
                          label="Point de vente"
                          icon={MonitorSmartphone}
                          active={pathname === "/app/pos" || (pathname.startsWith("/app/pos") && !pathname.startsWith("/app/pos/receipts"))}
                        />
                        <NavLink
                          href="/app/pos/receipts"
                          label="Tickets"
                          icon={Receipt}
                          active={pathname.startsWith("/app/pos/receipts")}
                        />
                      </NavSection>

                      <NavSection
                        title="Achats"
                        accent="amber"
                        isActive={
                          pathname.startsWith("/app/purchases") ||
                          pathname.startsWith("/app/receipts") ||
                          pathname.startsWith("/app/suppliers")
                        }
                      >
                        <NavLink href="/app/purchases" label="Achats" icon={ShoppingCart} active={pathname.startsWith("/app/purchases")} />
                        <NavLink href="/app/receipts" label="Réceptions" icon={Receipt} active={pathname.startsWith("/app/receipts")} />
                        <NavLink href="/app/suppliers" label="Fournisseurs" icon={Truck} active={pathname.startsWith("/app/suppliers")} />
                      </NavSection>

                      <NavSection
                        title="Stock"
                        accent="emerald"
                        isActive={
                          pathname.startsWith("/app/stock") ||
                          pathname.startsWith("/app/products") ||
                          pathname.startsWith("/app/pricelists") ||
                          pathname.startsWith("/app/warehouses") ||
                          pathname.startsWith("/app/stores")
                        }
                      >
                        <NavLink href="/app/stock" label="Stock" icon={Boxes} active={pathname.startsWith("/app/stock")} />
                        <NavLink href="/app/products" label="Produits" icon={Package} active={pathname.startsWith("/app/products")} />
                        <NavLink href="/app/pricelists" label="Tarifs" icon={Tags} active={pathname.startsWith("/app/pricelists")} />
                        <NavLink href="/app/warehouses" label="Entrepôts" icon={Warehouse} active={pathname.startsWith("/app/warehouses")} />
                        <NavLink href="/app/stores" label="Magasins" icon={StoreIcon} active={pathname.startsWith("/app/stores")} />
                      </NavSection>

                      <NavSection title="Fiscal" accent="violet" isActive={pathname.startsWith("/app/fiscal")}>
                        <NavLink href="/app/fiscal" label="FNE / RNE" icon={BadgeCheck} active={pathname.startsWith("/app/fiscal")} />
                      </NavSection>
                    </nav>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-emerald-950/40 pt-3">
                      <ThemeToggle />
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-950/40 bg-white/5 px-2 py-1 text-xs text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        Offline-ready
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </header>

          <main className="flex-1 px-6 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}