"use client";

import type { OrderFulfilment, TimelineStep } from "@/lib/types";
import { DotIcon, JOURNEY_ICONS } from "./icons";
import { RouteLine } from "./Availability";

/**
 * The order journey.
 *
 * Every stop on the route is shown from the start, so a buyer can see the
 * whole path the moment they pay rather than discovering it a step at a time.
 * What is done, what is happening now and what is still ahead are three
 * visually distinct states — and a step is only ever marked done because the
 * backend recorded that it happened.
 */
export function JourneyTimeline({
  timeline,
  fulfilment,
  className = "",
}: {
  timeline: TimelineStep[];
  fulfilment: OrderFulfilment;
  className?: string;
}) {
  if (!timeline.length) return null;

  const done = timeline.filter((step) => step.state === "done").length;
  const currentIndex = timeline.findIndex((step) => step.state === "current");
  // The line fills to the middle of the active stop, so the progress bar and
  // the marker agree with each other.
  const reached = currentIndex >= 0 ? currentIndex : done - 1;
  const percent = timeline.length > 1 ? Math.max(0, (reached / (timeline.length - 1)) * 100) : 0;

  return (
    <section aria-label="Order progress" className={className}>
      {/* Header: the route and the promise, before the detail. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-line)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
            {fulfilment.label}
          </p>
          {fulfilment.is_local ? (
            <p className="mt-0.5 text-[13px] font-bold">
              {fulfilment.destination?.flag} Delivering within {fulfilment.destination?.name ?? "Tanzania"}
            </p>
          ) : (
            <RouteLine
              from={fulfilment.origin}
              to={fulfilment.destination}
              className="mt-0.5 text-[color:var(--color-ink)]"
            />
          )}
        </div>

        {fulfilment.estimated_arrival_at ? (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
              Expected by
            </p>
            <p className="mt-0.5 text-[13px] font-extrabold">
              {formatDate(fulfilment.estimated_arrival_at)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Progress rail. Reads as one continuous journey rather than a list. */}
      <div className="px-4 pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-line)]">
          <div
            className="h-full rounded-full bg-[color:var(--color-brand)] transition-[width] duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-[color:var(--color-ink-muted)]">
          Step {Math.min(reached + 1, timeline.length)} of {timeline.length}
        </p>
      </div>

      <ol className="relative px-4 py-4">
        {timeline.map((step, index) => {
          const Icon = JOURNEY_ICONS[step.icon] ?? DotIcon;
          const last = index === timeline.length - 1;

          const marker =
            step.state === "done"
              ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
              : step.state === "current"
                ? "border-[color:var(--color-brand)] bg-white text-[color:var(--color-brand)] ring-4 ring-[color:var(--color-brand-100)]"
                : "border-[color:var(--color-line-strong)] bg-white text-[color:var(--color-ink-faint)]";

          return (
            <li key={`${step.status}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
              {/* Connector, drawn behind the markers and stopped at the last. */}
              {!last ? (
                <span
                  aria-hidden="true"
                  className={`absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5 ${
                    step.state === "done"
                      ? "bg-[color:var(--color-brand)]"
                      : "bg-[color:var(--color-line)]"
                  }`}
                />
              ) : null}

              <span
                className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${marker}`}
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1 pt-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[14px] font-bold ${
                      step.state === "upcoming"
                        ? "text-[color:var(--color-ink-faint)]"
                        : "text-[color:var(--color-ink)]"
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.state === "current" ? (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-100)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-brand)]">
                      <span className="track-pulse h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand)]" />
                      Now
                    </span>
                  ) : null}
                </p>

                {step.note ? (
                  <p
                    className={`mt-0.5 text-[12px] leading-snug ${
                      step.state === "upcoming"
                        ? "text-[color:var(--color-ink-faint)]"
                        : "text-[color:var(--color-ink-muted)]"
                    }`}
                  >
                    {step.note}
                  </p>
                ) : null}

                <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[color:var(--color-ink-faint)]">
                  {step.happened_at ? <span>{formatDateTime(step.happened_at)}</span> : null}
                  {step.location ? <span>· {step.location}</span> : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {fulfilment.tracking_number ? (
        <div className="border-t border-[color:var(--color-line)] px-4 py-3 text-[12px]">
          <span className="text-[color:var(--color-ink-muted)]">
            {fulfilment.carrier ? `${fulfilment.carrier} · ` : ""}Tracking
          </span>{" "}
          <span className="font-bold tracking-wide">{fulfilment.tracking_number}</span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A one-line version for an order card in a list, where the full timeline
 * would drown the page.
 */
export function JourneyStrip({
  timeline,
  className = "",
}: {
  timeline: TimelineStep[];
  className?: string;
}) {
  if (!timeline.length) return null;

  const currentIndex = timeline.findIndex((step) => step.state === "current");
  const reached = currentIndex >= 0 ? currentIndex : timeline.filter((s) => s.state === "done").length - 1;

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-hidden="true">
      {timeline.map((step, index) => (
        <span
          key={`${step.status}-${index}`}
          className={`h-1.5 flex-1 rounded-full ${
            index <= reached ? "bg-[color:var(--color-brand)]" : "bg-[color:var(--color-line)]"
          }`}
        />
      ))}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
