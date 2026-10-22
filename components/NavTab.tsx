"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** One tab in the primary nav. Active for its own section, not just its exact URL. */
export function NavTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={"nav-tab" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}
