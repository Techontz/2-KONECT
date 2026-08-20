"use client";

import Link from "next/link";
import { Suspense } from "react";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { Inbox } from "@/components/chat/Inbox";
import { Skeleton } from "@/components/ui/Primitives";

/** The shopper's side of the inbox. The seller console renders the same one. */
export default function MessagesPage() {
  return (
    <SiteChrome>
      <div className="shell py-4 pb-tabbar">
        <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
          <Link href="/account" prefetch={false} className="crumb hover:text-[color:var(--color-brand)]">
            Your account
          </Link>
          <span aria-hidden="true">›</span>
          <span className="font-semibold text-[color:var(--color-ink)]">Messages</span>
        </nav>

        <h1 className="mb-4 text-[22px] font-black tracking-[-0.02em] md:text-[28px]">Messages</h1>

        <Suspense fallback={<Skeleton className="h-64 w-full rounded-[var(--radius-md)]" />}>
          <Inbox emptyHint="When you message a seller about a product, the conversation appears here." />
        </Suspense>
      </div>
    </SiteChrome>
  );
}
