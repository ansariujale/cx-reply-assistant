"use client";

import clsx from "clsx";
import { BookOpen, Inbox, ScrollText, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

const ITEMS: Item[] = [
  { href: "/", label: "Inbox", icon: Inbox, isActive: (p) => p === "/" || p.startsWith("/conversations") },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen, isActive: (p) => p.startsWith("/knowledge") },
  { href: "/logs", label: "AI logs", icon: ScrollText, isActive: (p) => p.startsWith("/logs") },
];

/** Pill navigation with an indicator that slides to the active route. */
export function NavTabs() {
  const pathname = usePathname();
  const activeIndex = ITEMS.findIndex((i) => i.isActive(pathname));
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = refs.current[activeIndex];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex]);

  return (
    <nav aria-label="Primary" className="relative flex items-center rounded-full bg-stone-200/50 p-1">
      {indicator && activeIndex >= 0 && (
        <span
          aria-hidden
          className="absolute bottom-1 top-1 rounded-full bg-white shadow-sm transition-all duration-300 ease-out-expo"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {ITEMS.map((item, i) => {
        const active = i === activeIndex;
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200",
              active ? "text-stone-900" : "text-stone-500 hover:text-stone-900",
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
