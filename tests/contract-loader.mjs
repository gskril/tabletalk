import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";
const root = process.cwd();
export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers")
    return {
      url: pathToFileURL(path.join(root, "tests/runtime-mock.mjs")).href,
      shortCircuit: true,
    };
  if (specifier === "next/headers")
    return {
      url: pathToFileURL(path.join(root, "tests/headers-mock.mjs")).href,
      shortCircuit: true,
    };
  if (specifier === "next/navigation")
    return {
      url: "data:text/javascript,export function redirect(url){throw new Error(url)}",
      shortCircuit: true,
    };
  if (specifier.startsWith("@/"))
    return {
      url: pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href,
      shortCircuit: true,
    };
  if (
    specifier.startsWith(".") &&
    context.parentURL?.includes(root) &&
    !context.parentURL?.includes("node_modules") &&
    !path.extname(specifier)
  )
    return {
      url: new URL(specifier + ".ts", context.parentURL).href,
      shortCircuit: true,
    };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith(".ts") && !url.includes("node_modules")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
      shortCircuit: true,
    };
  }
  return next(url, context);
}
