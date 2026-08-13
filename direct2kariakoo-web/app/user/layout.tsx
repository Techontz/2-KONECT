import "../globals.css";
import Script from "next/script";
import Footer from "./components/Footer";

export const metadata = {
  title: "User | Direct2Kariakoo",
  description: "Shop smart and direct from Kariakoo vendors.",
};

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* ✅ Load Google Maps only client-side */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
      />

      {/* ✅ Main content */}
      <main className="flex-grow">{children}</main>

      {/* ✅ Global Footer */}
      <Footer />
    </div>
  );
}
