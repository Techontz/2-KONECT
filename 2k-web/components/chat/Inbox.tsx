"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import shop from "@/lib/shop";
import type { ChatThread } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/store/auth";
import { ChatPanel } from "./ChatPanel";
import { Button, EmptyState, Skeleton } from "@/components/ui/Primitives";

/**
 * The conversation inbox, for whoever is signed in.
 *
 * One implementation serving both sides of the marketplace: a shopper sees the
 * sellers they have messaged, a seller sees the shoppers asking about their
 * products. The backend scopes every thread to the caller, so a second copy
 * for the seller console would only be a copy that drifts — which is exactly
 * what the console had, five hundred lines of it, reading a storage key that
 * no longer existed and so never loading anything at all.
 */
export function Inbox({ emptyHint }: { emptyHint?: string }) {
  const { locale } = useLanguage();
  const { isAuthenticated, ready, requireAuth } = useAuth();
  const params = useSearchParams();

  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [openThread, setOpenThread] = useState<ChatThread | null>(null);

  const load = useCallback(async () => {
    try {
      setThreads(await shop.chatThreads());
    } catch {
      setThreads([]);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { void requireAuth(); return; }
    void load();
  }, [ready, isAuthenticated, requireAuth, load]);

  // Deep link from a notification or a bookmarked thread.
  useEffect(() => {
    const wanted = Number(params.get("user"));
    if (!wanted || !threads) return;
    const match = threads.find((thread) => thread.user_id === wanted);
    if (match) setOpenThread(match);
  }, [params, threads]);

  if (ready && !isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to see your messages"
        message="Conversations are tied to the account they were started from."
        action={<Button size="lg" onClick={() => void requireAuth()}>Sign in</Button>}
      />
    );
  }

  if (threads === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => <Skeleton key={index} className="h-20 w-full rounded-[var(--radius-md)]" />)}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<ChatIcon className="h-9 w-9" />}
        title="No messages yet"
        message={emptyHint ?? "Conversations you start with a seller appear here."}
      />
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {threads.map((thread) => (
          <li key={thread.user_id}>
            <button
              type="button"
              onClick={() => setOpenThread(thread)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-left transition-all hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-card)]"
            >
              {thread.avatar ? (
                <img src={thread.avatar} alt="" loading="lazy"
                  className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-sm font-black text-[color:var(--color-brand)]">
                  {thread.name.charAt(0).toUpperCase()}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="clamp-1 text-[14px] font-extrabold">{thread.name}</span>
                  {thread.unread > 0 ? (
                    <span className="shrink-0 rounded-full bg-[color:var(--color-brand)] px-1.5 py-[1px] text-[10px] font-black text-white">
                      {thread.unread}
                    </span>
                  ) : null}
                </span>
                <span className="clamp-1 block text-[12px] text-[color:var(--color-ink-muted)]">
                  {thread.last_message}
                </span>
                {thread.product ? (
                  <span className="clamp-1 block text-[11px] text-[color:var(--color-ink-faint)]">
                    About: {thread.product.name}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 text-[11px] text-[color:var(--color-ink-faint)]">
                {formatDay(thread.last_at, locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openThread ? (
        <ChatPanel
          open
          onClose={() => {
            setOpenThread(null);
            // Re-read so the unread badge and ordering reflect what was read.
            void load();
          }}
          vendorId={openThread.vendor_id}
          vendorUserId={openThread.user_id}
          vendorName={openThread.name}
          vendorLogo={openThread.avatar}
          product={openThread.product}
        />
      ) : null}
    </>
  );
}

function formatDay(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1121 12z" />
    </svg>
  );
}
