"use client";

import { usePageContent } from "@/lib/i18n";
import { ContentPage } from "@/components/content/ContentPage";

export default function Page() {
  const copy = usePageContent("returns");

  return (
    <ContentPage
      title={copy.title}
      intro={copy.intro}
      updated={copy.updated}
      sections={copy.sections}
    />
  );
}
