import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { ModeBadge } from "./ModeBadge";
import { NavTabs } from "./NavTabs";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="CX Reply Assistant home">
            <BrandMark size={32} className="transition-transform duration-500 ease-out-expo group-hover:-rotate-6 group-hover:scale-105" />
            <span className="display hidden text-[15px] font-semibold text-stone-900 sm:inline">CX Reply Assistant</span>
          </Link>
          <div className="ml-2">
            <NavTabs />
          </div>
          <div className="ml-auto">
            <ModeBadge />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
