"use client";

// Call notes saved from the Quick note tab, kept in the browser like decisions.
// Pending follow-ups shows their reminders and CRM check shows their CRM changes, so a note does not sit on its own.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Change } from "./crm-list";

export type NoteReminder = { id: string; what: string; who: string; due: string | null; dueText: string | null; quote: string };
export type SavedNote = {
  id: string;
  at: string; // when it was typed (real time)
  date: string; // the call date in the demo's calendar (dataset "today")
  leadId: string;
  company: string;
  owner: string;
  value: number | null;
  text: string;
  changes: Change[];
  reminders: NoteReminder[];
};

type Ctx = { notes: SavedNote[]; save: (n: SavedNote) => void; remove: (id: string) => void };

const KEY = "atliq-notes-v1";
const NotesContext = createContext<Ctx | null>(null);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<SavedNote[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setNotes(JSON.parse(raw));
    } catch {
      /* storage unavailable: notes just won't persist */
    }
  }, []);

  const write = (next: SavedNote[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  };
  const save = useCallback((n: SavedNote) => setNotes((prev) => write([n, ...prev.filter((p) => p.id !== n.id)])), []);
  const remove = useCallback((id: string) => setNotes((prev) => write(prev.filter((p) => p.id !== id))), []);

  return <NotesContext.Provider value={{ notes, save, remove }}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used inside NotesProvider");
  return ctx;
}
