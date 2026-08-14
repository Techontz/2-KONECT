"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import shop from "@/lib/shop";
import type { Address, AddressInput } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { AddressForm, TZ_REGIONS } from "@/components/account/AddressForm";
import { Button, EmptyState, Skeleton } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * Delivery address book.
 *
 * Reads and writes the customer's real saved addresses through
 * `/api/shop/addresses` — there is no local-only copy, so what is shown here
 * is what checkout and the courier will use.
 */
export default function AddressesPage() {
  return (
    <SiteChrome>
      <AddressesContent />
    </SiteChrome>
  );
}

function AddressesContent() {
  const t = useT();
  const { isAuthenticated, ready, requireAuth } = useAuth();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);

  const load = useCallback(async () => {
    try {
      setAddresses(await shop.addresses());
      setError(null);
    } catch {
      setError(t("address.loadFailed"));
      setAddresses([]);
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

  /** Every mutation returns the full list, so the UI never guesses the new state. */
  async function run(action: () => Promise<Address[]>, id: number | null = null) {
    setBusyId(id);
    try {
      setAddresses(await action());
      setError(null);
    } catch {
      setError(t("address.saveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (ready && !isAuthenticated) {
    return (
      <EmptyState
        title={t("address.signInTitle")}
        message={t("address.signInHint")}
        action={
          <Button size="lg" onClick={() => void requireAuth()}>
            {t("account.signInAction")}
          </Button>
        }
      />
    );
  }

  const showForm = adding || editing !== null;

  return (
    <div className="shell py-4">
      <nav className="mb-3 flex items-center gap-1 text-[12px] text-[color:var(--color-ink-muted)]">
        <Link href="/account" className="crumb hover:underline">{t("account.title")}</Link>
        <span aria-hidden="true">›</span>
        <span className="font-semibold text-[color:var(--color-ink)]">{t("address.title")}</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-black leading-tight">{t("address.title")}</h1>
          <p className="text-[13px] text-[color:var(--color-ink-muted)]">
            {t("address.subtitle")}
          </p>
        </div>

        {!showForm ? (
          <Button
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            {t("address.add")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-[var(--radius-sm)] bg-[#fdecec] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-sale)]"
        >
          {error}
        </p>
      ) : null}

      {showForm ? (
        <AddressForm
          initial={editing}
          // The very first address has to be the default, so the toggle is
          // locked on rather than offering a choice that cannot be honoured.
          forceDefault={(addresses?.length ?? 0) === 0}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSubmit={async (values: AddressInput) => {
            await run(() =>
              editing
                ? shop.updateAddress(editing.id, values)
                : shop.createAddress(values),
            );
            setAdding(false);
            setEditing(null);
          }}
        />
      ) : null}

      {addresses === null ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : addresses.length === 0 && !showForm ? (
        <EmptyState
          title={t("address.empty")}
          message={t("address.emptyHint")}
          action={<Button size="lg" onClick={() => setAdding(true)}>{t("address.addFirst")}</Button>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={`rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4 ${
                address.is_default
                  ? "ring-2 ring-[color:var(--color-action)]"
                  : "ring-1 ring-[color:var(--color-line)]"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 clamp-1 text-[15px] font-extrabold">{address.full_name}</p>
                {address.is_default ? (
                  <span className="shrink-0 rounded-full bg-[color:var(--color-action)] px-2 py-[3px] text-[10px] font-black uppercase tracking-wide text-white">
                    {t("address.default")}
                  </span>
                ) : null}
              </div>

              <p className="text-[13px] text-[color:var(--color-ink-muted)]">{address.phone}</p>
              <p className="mt-1 text-[13px] leading-relaxed">{address.formatted || "—"}</p>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--color-line)] pt-3">
                {!address.is_default ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === address.id}
                    onClick={() => void run(() => shop.setDefaultAddress(address.id), address.id)}
                  >
                    {busyId === address.id ? t("common.saving") : t("address.setDefault")}
                  </Button>
                ) : null}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAdding(false);
                    setEditing(address);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {t("common.edit")}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(address)}
                >
                  <span className="text-[color:var(--color-sale)]">{t("common.remove")}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-remove-title" className="text-[17px] font-black">{t("address.removeTitle")}</h2>
            <p className="mt-2 text-[13px] text-[color:var(--color-ink-muted)]">
              {confirmDelete.full_name} — {confirmDelete.formatted}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t("address.keepIt")}</Button>
              <Button
                onClick={async () => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  await run(() => shop.deleteAddress(target.id), target.id);
                }}
              >
                {t("address.removeAction")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-[11px] text-[color:var(--color-ink-faint)]">
        {t("address.regionsNote", { count: TZ_REGIONS.length })}
      </p>
    </div>
  );
}
