import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { IdentityProvider } from "@/lib/identity/client";
import "./globals.css";

// Public Sans carries the service itself: it is the typeface the Australian Government
// Design System uses, it is open, and it holds up at the sizes a records table needs.
const sans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-text",
  display: "swap",
});

// Fraunces is kept for the public page only, where the register speaks about Country
// rather than processing a task.
const serif = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT"],
  variable: "--font-display",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono-ref",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noddie — heritage register",
  description:
    "A heritage register used by Traditional Owner corporations. The authority to reveal a place, or to permit works on it, exists only when that community’s own custodians agree.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <IdentityProvider>{children}</IdentityProvider>
      </body>
    </html>
  );
}
