"use client";

import { useT } from "@/lib/i18n";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { ListingView } from "@/components/product/ListingView";
import { Skeleton } from "@/components/ui/Primitives";
import { COUNTRIES } from "@/lib/countries";

/**
 * Everything 2KONECT will bring in for you.
 *
 * No explainer above the grid, and the availability tabs are left unlocked:
 * they say which half of the catalogue you are looking at and let you cross to
 * the other one, which is the whole distinction stated in a control rather
 * than in three paragraphs. Every card repeats the answer on its own strip —
 * source country and arrival window — so a shopper is never guessing.
 *
 * How importing works lives on the homepage and in /help/delivery, where
 * somebody who wants it reads it once instead of meeting it every time they
 * browse.
 */
export default function AbroadShopPage() {
  return (
    <SiteChrome>
      <Suspense fallback={<div className="shell py-6"><Skeleton className="h-40 w-full" /></div>}>
        <AbroadContent />
      </Suspense>
    </SiteChrome>
  );
}

function AbroadContent() {
  const t = useT();
  const params = useSearchParams();

  // "Shop by country" links here. Only a two-letter code we recognise is
  // accepted — anything else is ignored rather than passed to the API.
  const raw = (params.get("country") ?? "").toUpperCase();
  const country = COUNTRIES[raw] ? raw : undefined;
  const origin = country ? COUNTRIES[country] : null;

  return (
    <ListingView
      baseQuery={{ availability: "import", source_country: country }}
      heading={origin ? t("listing.fromCountry", { country: origin.name }) : t("listing.abroadHeading")}
      emptyMessage={t("listing.abroadEmpty")}
    />
  );
}
