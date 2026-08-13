"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage, useT } from "@/lib/i18n";
import shop from "@/lib/shop";
import { useAuth } from "@/lib/store/auth";
import type { ChatMessage, ChatProductContext } from "@/lib/types";
import { Button } from "@/components/ui/Primitives";

/**
 * Shopper ↔ seller conversation.
 *
 * A drawer on desktop and a full-screen sheet on a phone, both backed by the
 * real `/shop/chat` endpoints — messages are persisted server-side, so the
 * thread survives a refresh and the seller sees it in their own inbox.
 *
 * It polls while open rather than holding a socket: the volume here is a few
 * messages per conversation, and polling cannot leave a stale connection
 * behind when the panel closes.
 */
export function ChatPanel({
  open,
  onClose,
  vendorId,
  vendorUserId,
  vendorName,
  vendorLogo,
  product,
}: {
  open: boolean;
  onClose(): void;
  vendorId: number | null;
  /** The seller's account id; the thread is keyed on it. */
  vendorUserId: number | null;
  vendorName: string;
  vendorLogo?: string | null;
  product?: ChatProductContext | null;
}) {
  const t = useT();
  const { locale } = useLanguage();
  const { isAuthenticated, ready, requireAuth } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!vendorUserId) return;
    try {
      const data = await shop.chatThread(vendorUserId);
      setMessages(data.messages);
    } catch {
      setMessages([]);
    }
  }, [vendorUserId]);

  // Open → authenticate → load. Asking for sign-in only here keeps the rest
  // of the product page browsable without an account.
  useEffect(() => {
    if (!open || !ready) return;
    if (!isAuthenticated) {
      void requireAuth();
      return;
    }
    setMessages(null);
    void load();
  }, [open, ready, isAuthenticated, requireAuth, load]);

  // Poll for the seller's replies while the panel is open.
  useEffect(() => {
    if (!open || !isAuthenticated || !vendorUserId) return;
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [open, isAuthenticated, vendorUserId, load]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();

    const body = draft.trim();
    if (!body || sending) return;

    if (!(await requireAuth())) return;

    setSending(true);
    setError(null);

    try {
      const sent = await shop.sendChat({
        vendor_id: vendorId ?? undefined,
        user_id: vendorId ? undefined : vendorUserId ?? undefined,
        product_id: product?.id,
        message: body,
      });
      // Append rather than refetch, so the message appears instantly.
      setMessages((current) => [...(current ?? []), sent]);
      setDraft("");
      inputRef.current?.focus();
    } catch {
      setError(t("chat.failed"));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t("chat.title")} — ${vendorName}`}
      className="fixed inset-0 z-[140] flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col bg-[color:var(--color-surface)] sm:max-w-[420px] sm:shadow-[var(--shadow-pop)]"
      >
        {/* ---- header ---- */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-brand)] px-4 py-3">
          {vendorLogo ? (
            <img src={vendorLogo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm font-black">
              {vendorName.charAt(0)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="clamp-1 text-[15px] font-extrabold">{vendorName}</p>
            <p className="text-[11px] opacity-70">{t("chat.title")}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("chat.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* ---- what this conversation is about ---- */}
        {product ? (
          <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface-alt)] px-4 py-2.5">
            {product.image ? (
              <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-[var(--radius-xs)] bg-white object-contain p-0.5" />
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                {t("chat.about")}
              </p>
              <p className="clamp-1 text-[13px] font-semibold">{product.name}</p>
            </div>
          </div>
        ) : null}

        {/* ---- thread ---- */}
        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[color:var(--color-canvas)] p-4">
          {!isAuthenticated && ready ? (
            <p className="py-10 text-center text-[13px] text-[color:var(--color-ink-muted)]">
              {t("chat.signIn")}
            </p>
          ) : messages === null ? (
            <p className="py-10 text-center text-[13px] text-[color:var(--color-ink-muted)]">
              {t("chat.loading")}
            </p>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[14px] font-bold">{t("chat.empty")}</p>
              <p className="mt-1 text-[12px] text-[color:var(--color-ink-muted)]">{t("chat.emptyHint")}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-[var(--radius-md)] px-3 py-2 ${
                    message.mine
                      ? "bg-[color:var(--color-action)] text-white"
                      : "bg-[color:var(--color-surface)] ring-1 ring-[color:var(--color-line)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{message.body}</p>
                  <p className={`mt-1 text-[10px] ${message.mine ? "text-white/70" : "text-[color:var(--color-ink-faint)]"}`}>
                    {formatTime(message.sent_at, locale)}
                    {message.mine ? ` · ${message.read ? t("chat.read") : t("chat.sent")}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ---- composer ---- */}
        <form onSubmit={send} className="shrink-0 border-t border-[color:var(--color-line)] p-3">
          {error ? (
            <p role="alert" className="mb-2 text-[12px] font-semibold text-[color:var(--color-sale)]">
              {error}
            </p>
          ) : null}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a newline, as in every chat app.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.placeholder")}
              className="max-h-28 min-h-[42px] flex-1 resize-y rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-action)]"
            />
            <Button type="submit" disabled={sending || !draft.trim()} className="shrink-0">
              {sending ? t("chat.sending") : t("chat.send")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
