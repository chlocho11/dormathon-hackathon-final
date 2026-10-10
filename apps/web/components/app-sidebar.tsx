"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ShieldCheck } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { ApiStatus } from "./api-status";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2 px-2">
        <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
        <div>
          <p className="font-semibold leading-tight">TokenGuard</p>
          <p className="text-xs text-muted">Sweet Crumbs Bakery (demo)</p>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                  active ? "bg-accent-tint font-medium text-accent" : "text-ink hover:bg-black/[0.04]",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line px-2 pt-4">
        <ApiStatus />
      </div>
    </nav>
  );
}
