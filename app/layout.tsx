import type { Metadata } from "next";
import "./globals.css";
import { DecisionsProvider } from "./components/decisions";
import Nav from "./components/nav";
import { NotesProvider } from "./components/notes";

export const metadata: Metadata = {
  title: "AtliQ Sales Assistant",
  description: "Turns scattered emails and notes into an up-to-date CRM and a daily priority list.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <DecisionsProvider>
          <NotesProvider>
            <header className="top">
              <div className="top-inner">
                <span className="brand">AtliQ Sales Assistant</span>
                <Nav />
              </div>
            </header>
            <main>{children}</main>
          </NotesProvider>
        </DecisionsProvider>
      </body>
    </html>
  );
}
