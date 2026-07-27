import { Prisma } from "@/generated/prisma/client";

const MAX_PAYLOAD_BYTES = 50 * 1024;
const REDACTED = "[REDACTED]";
const OMIT = Symbol("omit");

const EXACT_REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "accesstoken",
  "refreshtoken",
  "token",
  "invitetoken",
  "invitationtoken",
  "authorization",
  "cookie",
  "setcookie",
  "session",
  "secret",
  "clientsecret",
  "servicerole",
  "servicerolekey",
  "apikey",
  "databaseurl",
  "directurl",
  "connectionstring",
  "supabasesecretkey",
]);

function normalizeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key);
  if (EXACT_REDACTED_KEYS.has(normalized)) {
    return true;
  }

  return (
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("key") ||
    normalized.includes("password") ||
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("session")
  );
}

function isForbiddenObject(value: object) {
  if (value instanceof Request || value instanceof Response || value instanceof Headers) {
    return true;
  }

  const constructorName = value.constructor?.name?.toLowerCase() ?? "";
  return (
    constructorName.includes("request") ||
    constructorName.includes("response") ||
    constructorName.includes("headers") ||
    constructorName.includes("cookie") ||
    constructorName.includes("session") ||
    constructorName.includes("env")
  );
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): Prisma.JsonValue | typeof OMIT {
  if (value === undefined) return OMIT;
  if (value === null) return null;

  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;

  if (Prisma.Decimal.isDecimal(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const sanitizedArray: Prisma.JsonValue[] = [];
    for (const item of value) {
      const sanitizedItem = sanitizeValue(item, seen);
      if (sanitizedItem !== OMIT) {
        sanitizedArray.push(sanitizedItem);
      }
    }
    return sanitizedArray;
  }

  if (typeof value !== "object") return OMIT;
  if (!value) return null;

  if (isForbiddenObject(value)) {
    return REDACTED;
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  const output: Record<string, Prisma.JsonValue> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      output[key] = REDACTED;
      continue;
    }

    if (
      /^(headers?|cookies?|request|response|env|environment|session|providerresponse)$/i.test(key)
    ) {
      output[key] = REDACTED;
      continue;
    }

    const sanitizedNested = sanitizeValue(nestedValue, seen);
    if (sanitizedNested !== OMIT) {
      output[key] = sanitizedNested;
    }
  }

  return output;
}

function truncateIfTooLarge(
  payload: Prisma.JsonValue | undefined,
  key: "beforeData" | "afterData" | "metadata",
): Prisma.JsonValue | undefined {
  if (payload === undefined) return undefined;
  const serialized = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(serialized, "utf8");
  if (sizeBytes <= MAX_PAYLOAD_BYTES) {
    return payload;
  }

  return {
    _truncated: true,
    _field: key,
    _message: "Audit payload exceeded 50KB and was truncated.",
    _originalBytes: sizeBytes,
    _maxBytes: MAX_PAYLOAD_BYTES,
  };
}

export function sanitizeAuditData(
  value: unknown,
  key: "beforeData" | "afterData" | "metadata",
): Prisma.JsonValue | undefined {
  const sanitized = sanitizeValue(value, new WeakSet<object>());
  if (sanitized === OMIT) {
    return undefined;
  }

  return truncateIfTooLarge(sanitized, key);
}
