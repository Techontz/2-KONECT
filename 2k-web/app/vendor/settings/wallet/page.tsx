"use client";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import vendorApi, { type VendorWallet } from "@/lib/vendor";
import { Button, EmptyState, Notice, Skeleton } from "@/components/ui/Primitives";

/**
 * Seller wallet.
 *
 * Earnings, and the payouts asked for against them. The endpoint behind this
 * existed in the backend from the start but was never routed, so this screen
 * could only ever say "no wallet data available" beside two buttons that did
 * nothing.
 */
export default function VendorWalletPage() {
  const t = useT();
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [failed, setFailed] = useState(false);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("M-Pesa");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(() => {
    vendorApi.wallet().then(setWallet).catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await vendorApi.requestPayout({
        amount: Number(amount),
        method,
        account_number: account.trim(),
      });

      setDone(result.message);
      setOpen(false);
      setAmount("");
      setAccount("");
      load();
    } catch (err) {
      setError(apiError(err, t("seller.payoutFailed")));
    } finally {
      setBusy(false);
    }
  }

  const balance = wallet?.balance ?? 0;
  // The backend refuses anything under this, so the form does too rather than
  // letting a seller find out by being rejected.
  const minimum = 1000;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <Link
          href="/vendor/settings"
          prefetch={false}
          className="text-[12px] font-semibold text-[color:var(--color-brand)] hover:underline"
        >
          ← Store settings
        </Link>
        <h1 className="mt-1 text-[24px] font-black tracking-[-0.025em]">{t("seller.wallet")}</h1>
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          What you have earned, and the payouts you have asked for.
        </p>
      </header>

      {done ? <Notice tone="success">{done}</Notice> : null}

      {failed ? (
        <EmptyState
          title={t("seller.walletLoadFailed")}
          message={t("common.offline")}
          action={<Button onClick={load}>{t("common.retry")}</Button>}
        />
      ) : wallet === null ? (
        <Skeleton className="h-40 rounded-[var(--radius-md)]" />
      ) : (
        <>
          <section className="brand-ground overflow-hidden rounded-[var(--radius-md)] p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/65">
              Available balance
            </p>
            <p className="mt-1 text-[34px] font-black tracking-[-0.03em] text-white sm:text-[42px]">
              {formatMoney(balance)}
            </p>
            <p className="mt-1 text-[13px] text-white/70">
              Earned on completed orders. Payouts are reviewed before they are sent.
            </p>

            <Button
              variant="secondary"
              className="mt-4"
              disabled={balance < minimum}
              onClick={() => { setOpen(true); setError(null); setDone(null); }}
            >
              Request a payout
            </Button>

            {balance < minimum ? (
              <p className="mt-2 text-[12px] text-white/60">
                The minimum payout is {formatMoney(minimum)}.
              </p>
            ) : null}
          </section>

          {/* ---- the request form ---- */}
          {open ? (
            <form
              onSubmit={submit}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4"
            >
              <h2 className="text-[15px] font-black">{t("seller.requestPayout")}</h2>
              <p className="mt-0.5 text-[13px] text-[color:var(--color-ink-muted)]">
                The amount leaves your balance straight away and is recorded as pending
                until it is paid.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">{t("seller.amount", { currency: BRAND.currency })}</span>
                  <input
                    type="number"
                    required
                    min={minimum}
                    max={balance}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={String(minimum)}
                    className={`${FIELD} h-12`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">{t("seller.sendTo")}</span>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className={`${FIELD} h-12`}
                  >
                    {["M-Pesa", "Tigo Pesa", "Airtel Money", "HaloPesa", t("seller.bankTransfer")].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-bold">
                    {method === t("seller.bankTransfer") ? t("seller.accountNumber") : t("seller.phoneNumber")}
                  </span>
                  <input
                    required
                    value={account}
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder={method === t("seller.bankTransfer") ? "0123456789" : "07XX XXX XXX"}
                    className={`${FIELD} h-12`}
                  />
                </label>
              </div>

              {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="submit" loading={busy}>
                  {busy ? t("seller.sending") : t("seller.requestPayoutBtn")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {/* ---- history ---- */}
          <section className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
            <h2 className="border-b border-[color:var(--color-line)] p-4 text-[15px] font-black">
              Payout history
            </h2>

            {wallet.payouts.length === 0 ? (
              <EmptyState
                title={t("seller.noPayouts")}
                message={t("seller.noPayoutsHint")}
              />
            ) : (
              <ul className="divide-y divide-[color:var(--color-line)]">
                {wallet.payouts.map((payout) => (
                  <li key={payout.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                    <span className="text-[15px] font-black">{formatMoney(payout.amount)}</span>
                    <span className="text-[13px] text-[color:var(--color-ink-muted)]">
                      {payout.method}
                      {payout.account_number ? ` · ${payout.account_number}` : ""}
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                      {payout.requested_at ? (
                        <span className="text-[12px] text-[color:var(--color-ink-faint)]">
                          {formatDate(payout.requested_at)}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-[var(--radius-xs)] px-2 py-1 text-[11px] font-bold ${
                          payout.status === "paid"
                            ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
                            : payout.status === "rejected"
                              ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
                              : "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)]"
                        }`}
                      >
                        {payout.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const FIELD =
  "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none transition-colors focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand-200)]";
