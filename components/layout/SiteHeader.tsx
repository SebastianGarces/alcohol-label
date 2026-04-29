"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Single" },
  { href: "/batch", label: "Batch" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-ledger bg-paper">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="rounded-md text-lg font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2"
        >
          TTB Label Verifier
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-12 min-w-12 items-center justify-center rounded-md px-4 text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2",
                      active ? "bg-ink text-paper" : "text-ink hover:bg-bone",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
