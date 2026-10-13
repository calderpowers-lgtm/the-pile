import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Libre_Bodoni, Newsreader, Outfit } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { ServiceWorker } from "@/components/service-worker";
import { BASE_PATH } from "@/lib/base-path";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const bodoni = Libre_Bodoni({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const themeBoot = `(function(){try{document.documentElement.classList.remove("dark");localStorage.removeItem("pile.theme.v1");}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "The Pile",
    template: "%s · The Pile",
  },
  description:
    "A gratitude practice. Write your sheet, draw one life from the pile, and see if you take yours back.",
  applicationName: "The Pile",
  appleWebApp: {
    capable: true,
    title: "The Pile",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${BASE_PATH}/icons/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F9F6F0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${newsreader.variable} ${bodoni.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
