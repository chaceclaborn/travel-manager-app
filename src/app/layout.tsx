import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "../../public/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../../public/fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#f59e0b",
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
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
  // Tell Dark Reader (and similar dark-mode extensions) to leave the app
  // alone — we have our own theme system and the extension's DOM mutations
  // cause noisy hydration warnings on every page load.
  other: {
    "darkreader-lock": "",
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
        {children}
      </body>
    </html>
  );
}
