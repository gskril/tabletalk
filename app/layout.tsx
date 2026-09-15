import type { Metadata } from "next";
import "./globals.css";
import WebMCP from "@/components/webmcp";
export const metadata: Metadata = {
  title: "Tabletalk — NYC, by taste",
  description:
    "Find your next favorite table. Public restaurant lists, honest reviews, and a dining notebook powered by Flynet.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <WebMCP />
      </body>
    </html>
  );
}
