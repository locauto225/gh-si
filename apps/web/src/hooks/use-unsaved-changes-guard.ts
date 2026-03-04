import { useEffect } from "react";

type GuardOptions = {
  when: boolean;
  message?: string;
};

export function useUnsavedChangesGuard({ when, message = "Quitter sans enregistrer ?" }: GuardOptions) {
  useEffect(() => {
    if (!when) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onDocumentClick = (e: MouseEvent) => {
      if (!when) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      const currentUrl = new URL(window.location.href);
      if (nextUrl.href === currentUrl.href) return;

      const ok = window.confirm(message);
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [message, when]);
}

