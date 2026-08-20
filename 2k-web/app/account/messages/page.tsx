"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import shop from "@/lib/shop";
import type { ChatThread } from "@/lib/types";
import { useLanguage, useT } from "@/lib/i18n";
import { useAuth } from "@/lib/store/auth";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Button, EmptyState, Skeleton } from "@/components/ui/Primitives";

/**
 * Conversation inbox.
 *
 * The same page serves both sides of the marketplace: a shopper sees the
 * sellers they have messaged, and a seller sees the shoppers asking about
 * their products. The backend scopes each thread to the caller, so there is
 * one screen rather than two that can drift apart.
 */
export default function MessagesPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-4"><Skeleton className="h-64 w-full" /></div>}>
        <MessagesContent />
      </Suspense>
    </SiteChrome>
  );
}

function MessagesContent() {
  const t = useT();
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
    if (!isAuthenticated) {
      void requireAuth();
      return;
    }
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
        title={t("chat.signIn")}
        action={<Button size="lg" onClick={() => void requireAuth()}>{t("account.signInAction")}</Button>}
      />
    );
  }

  return (
    <div className="shell py-4">
      <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
        <Link href="/account" className="crumb hover:underline">{t("account.title")}</Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-[color:var(--color-ink)]">{t("chat.inbox")}</span>
      </nav>

      <h1 className="mb-4 text-[22px] font-black leading-tight md:text-[26px]">{t("chat.inbox")}</h1>

      {threads === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-20 w-full" />)}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState title={t("chat.inboxEmpty")} message={t("chat.inboxEmptyHint")} />
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.user_id}>
              <button
                type="button"
                onClick={() => setOpenThread(thread)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-3 text-left ring-1 ring-[color:var(--color-line)] transition-shadow hover:shadow-[var(--shadow-hover)]"
              >
                {thread.avatar ? (
                  <img src={thread.avatar} alt="" loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-alt)] text-sm font-black">
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
                      {t("chat.about")}: {thread.product.name}
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
      )}

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
    </div>
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
