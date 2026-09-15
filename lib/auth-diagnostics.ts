const kinds = new Set(["unauthorized", "insufficient_scope", "forbidden", "not_found", "validation", "rate_limited", "server", "network", "unknown"]);
const codes = new Set(["invalid_client", "invalid_grant", "invalid_request", "invalid_scope", "insufficient_scope", "unauthorized_client", "access_denied", "SDKValidationError"]);
/** Only allowlisted metadata: never log messages, response bodies, URLs or tokens. */
export function authDiagnostic(error: unknown) {
  const e = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const raw = e.raw && typeof e.raw === "object" ? e.raw as Record<string, unknown> : {};
  const cause = raw.cause && typeof raw.cause === "object" ? raw.cause as Record<string, unknown> : {};
  const issues = Array.isArray(cause.issues) ? cause.issues : [];
  const fields = new Set(["id", "object", "first_name", "last_name", "email", "phone_number", "birthdate", "zipcode", "avatar", "account_status", "created_at", "updated_at"]);
  return {
    kind: typeof e.kind === "string" && kinds.has(e.kind) ? e.kind : "unknown",
    status: typeof e.status === "number" && Number.isInteger(e.status) ? e.status : null,
    code: typeof e.code === "string" && codes.has(e.code) ? e.code : null,
    invalidFields: issues.flatMap((issue: unknown) => {
      if (!issue || typeof issue !== "object" || !("path" in issue) || !Array.isArray(issue.path)) return [];
      return issue.path.filter((part: unknown) => typeof part === "string" && fields.has(part));
    }).slice(0, 15),
  };
}
