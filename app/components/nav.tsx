"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/", "Pending follow-ups"],
  ["/crm-check", "CRM check"],
  ["/quick-note", "Quick note"],
] as const;

export default function Nav() {
  const path = usePathname();
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <nav className="nav">
        {TABS.map(([href, label]) => <Link key={href} href={href} className={on(href) ? "active" : ""}>{label}</Link>)}
      </nav>
      <Link href="/about" className={`about-link${on("/about") ? " active" : ""}`}>About</Link>
    </>
  );
}
