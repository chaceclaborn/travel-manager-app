import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DeepLinkRouter } from "@/components/travelmanager/DeepLinkRouter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  colorScheme: "only light", // opt out of Chrome Auto Dark Mode (light-only palette)
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // enables iOS env(safe-area-inset-*) values
};

export const metadata: Metadata = {
  title: {
    default: "Travel Manager",
    template: "%s | Travel Manager",
  },
  description: "Business travel management platform — plan trips, track expenses, manage bookings, and organize your travel life.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Travel Manager",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-180.png",
  },
  // Tell Dark Reader (and similar dark-mode extensions) to leave the app
  // alone — we have our own theme system and the extension's DOM mutations
  // cause noisy hydration warnings on every page load.
  other: {
    // Next.js drops `other` meta entries whose value is an empty string, so
    // this must be non-empty for the tag to render. Dark Reader only checks
    // that the tag exists; the content is ignored.
    "darkreader-lock": "true",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`} suppressHydrationWarning>
        {/* Mounted at the ROOT, not inside (app). It used to live in the (app)
            layout, which meant deep links were dead on every page outside that
            group — privacy, terms, support, tour. Two travelmanager://settings/
            calls did nothing while the app sat on the Privacy page, and a push
            notification tapped from there went nowhere. Those pages became
            somewhere users actually land once the legal links started working,
            so the handler has to outlive the route group. */}
        <DeepLinkRouter />
        {children}
      </body>
    </html>
  );
}
