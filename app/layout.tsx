import type { Metadata } from "next";
import "./globals.css";
import WebMCP from "@/components/webmcp";
export const metadata: Metadata = {
  title: "Tabletalk — NYC, by taste",
  description:
    "Restaurants, reviews and lists from people you trust. A New York dining notebook connected to Blackbird.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
      </body>
    </html>
  );
}
