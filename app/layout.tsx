import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SiteBehaviour from "./site-behaviour";
import Dock from "./dock";
import ThemeToggle from "./theme-toggle";

// Self-hosted at build time — no runtime CDN request. Exposed as --font-inter,
// which globals.css feeds into the --font-sf token.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Portfolio — Homepage",
  description: "Single-column portfolio homepage.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
};

// Runs before first paint so there's no flash of the wrong palette.
const themeInit = `
(function(){
  try{
    var s = localStorage.getItem('theme');
    var m = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t = (s === 'light' || s === 'dark') ? s : (m ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeToggle />
        {children}
        <Dock />
        <SiteBehaviour />
      </body>
    </html>
  );
}
