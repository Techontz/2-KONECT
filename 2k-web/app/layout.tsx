import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately thin: it establishes the document, the typeface and the
 * metadata only. Every storefront route composes <SiteChrome> itself so
 * standalone surfaces (the seller console, auth pages) can opt out of the
 * shop header and footer.
 */

const brandFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-brand",
  display: "swap",
});

const description =
  "2KONECT connects you to what you need. Buy products already available in Tanzania for fast local delivery, or order from abroad at a lower price and track every step to your door.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description,
  applicationName: BRAND.name,
  keywords: [
    "2KONECT", "Tanzania marketplace", "online shopping Tanzania",
    "import from China", "order from abroad", "Dar es Salaam delivery",
    "verified sellers", "product sourcing",
  ],
  authors: [{ name: BRAND.name }],
  // app/icon.png and app/apple-icon.png are picked up by convention; the .ico
  // is named explicitly because older browsers ask for it by path.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description,
    url: SITE_URL,
    type: "website",
    locale: "en_TZ",
    images: [{ url: BRAND.logo.og, width: 1200, height: 630, alt: BRAND.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description,
    images: [BRAND.logo.og],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: BRAND.color.primary,
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available: capping it locks out anyone who needs to
  // enlarge the page to read it.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brandFont.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
