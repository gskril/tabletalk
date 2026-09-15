"use client";
import { useEffect } from "react";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export default function WebMCP() {
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (t: Tool, o: { signal: AbortSignal }) => void;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool(
        {
          name: "search_restaurants",
          title: "Search NYC restaurants",
          description:
            "Read matching Tabletalk restaurants. Does not save or publish anything.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", maxLength: 100 } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input) {
            if (
              !input ||
              typeof input !== "object" ||
              !("query" in input) ||
              typeof input.query !== "string" ||
              input.query.length > 100
            )
              throw new Error(
                "query must be a string of at most 100 characters",
              );
            const r = await fetch("/api/state");
            if (!r.ok) throw new Error("Restaurant data is unavailable");
            const d = (await r.json()) as {
              catalog?: { locationIds: string[] } | null;
              venues: {
                id: string;
                name: string;
                cuisine: string;
                neighborhood: string;
                source: string;
              }[];
            };
            const q = input.query.toLowerCase();
            const catalogIds = d.catalog ? new Set(d.catalog.locationIds) : null;
            return d.venues
              .filter((v) => !catalogIds || catalogIds.has(v.id))
              .filter((v) =>
                `${v.name} ${v.cuisine} ${v.neighborhood}`
                  .toLowerCase()
                  .includes(q),
              )
              .map((v) => ({
                id: v.id,
                name: v.name,
                neighborhood: v.neighborhood,
                source: v.source,
                url: `/restaurants/${v.id}`,
              }));
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, []);
  return null;
}
