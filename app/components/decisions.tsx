"use client";

// Stores the user's decisions in the browser: "approved" = to fix in CRM (or owner assigned), "fixed" = done in
// Kaizen, "rejected" = ignored, "done" = follow-up handled.
// Nothing is ever written to the CRM automatically: in the prototype, these changes are
// recorded here and listed in the audit log, ready to be applied to Kaizen by a person.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Decision = { status: "approved" | "fixed" | "rejected" | "done" | "snoozed"; value?: string; label: string; at: string };
type Store = Record<string, Decision>;
type Ctx = { decisions: Store; decide: (id: string, d: Omit<Decision, "at">) => void; undo: (id: string) => void; clear: () => void };

const KEY = "atliq-decisions-v1";
const DecisionsContext = createContext<Ctx | null>(null);

export function DecisionsProvider({ children }: { children: React.ReactNode }) {
  const [decisions, setDecisions] = useState<Store>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDecisions(JSON.parse(raw));
    } catch {
      /* storage unavailable: decisions just won't persist */
    }
  }, []);

  const persist = (next: Store) => {
    setDecisions(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const decide = useCallback((id: string, d: Omit<Decision, "at">) => {
    setDecisions((prev) => {
      const next = { ...prev, [id]: { ...d, at: new Date().toISOString() } };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const undo = useCallback((id: string) => {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return <DecisionsContext.Provider value={{ decisions, decide, undo, clear: () => persist({}) }}>{children}</DecisionsContext.Provider>;
}

export function useDecisions() {
  const ctx = useContext(DecisionsContext);
  if (!ctx) throw new Error("useDecisions must be used inside DecisionsProvider");
  return ctx;
}
