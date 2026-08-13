import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately thin: it establishes the document, the typeface and the
 * metadata only. Every storefront route composes <SiteChrome> itself so
 * standalone surfaces (vendor portal, auth pages) can opt out of the shop
 * header and footer.
 */

const brandFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: `Shop electronics, fashion, home, beauty and more from trusted ${BRAND.country} sellers. Fast delivery across ${BRAND.city}.`,
  applicationName: BRAND.name,
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
    type: "website",
    locale: "en_TZ",
  },
};

export const viewport: Viewport = {
  themeColor: "#fee500",
  width: "device-width",
  initialScale: 1,
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
