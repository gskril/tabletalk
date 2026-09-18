import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa";
import WebMCP from "@/components/webmcp";
export const metadata: Metadata = {
  title: "Tabletalk — NYC, by taste",
  description:
    "Restaurants, reviews and lists from people you trust. A New York dining notebook connected to Blackbird.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tabletalk", statusBarStyle: "default" },
  icons: { icon: "/favicon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf2",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Install before the framework runtime so app-owned history entries
            cannot trigger a second, conflicting route fetch on Back/Forward. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener("popstate",function(event){if(event.state&&event.state.tabletalkDocument&&window.__tabletalkTabNavigation){event.stopImmediatePropagation();window.dispatchEvent(new PopStateEvent("tabletalk:tab-popstate",{state:event.state}));}},true);`,
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link
          rel="preload"
          href="/fonts/dm-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/newsreader-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
        <WebMCP />
        <PwaRegistration />
      </body>
    </html>
  );
}
