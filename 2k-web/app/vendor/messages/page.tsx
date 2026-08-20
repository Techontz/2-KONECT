"use client";

import { Suspense } from "react";

import { Inbox } from "@/components/chat/Inbox";
import { Skeleton } from "@/components/ui/Primitives";

/**
 * The seller's side of the inbox.
 *
 * The same component the shopper sees — the backend scopes every thread to
 * whoever is signed in, so there is one inbox rather than two implementations
 * of it. The console's previous version read a `token` key that no longer
 * exists and so never loaded a single conversation.
 */
export default function VendorMessagesPage() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="text-[24px] font-black tracking-[-0.025em]">Messages</h1>
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          Shoppers asking about your products.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-[var(--radius-md)]" />}>
        <Inbox emptyHint="When a shopper messages you about one of your products, the conversation appears here." />
      </Suspense>
    </div>
  );
}
