export type SmtpConfigurationEntry = {
  name: "EMAIL_DELIVERY_MODE" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_SECURE" | "SMTP_USER" | "SMTP_PASSWORD" | "EMAIL_FROM";
  configured: boolean;
  valid: boolean;
  error: string | null;
};

export type SmtpConfigurationReport = {
  entries: SmtpConfigurationEntry[];
  complete: boolean;
};

export type SmtpConfiguration = {
  host: string;
  port: number;
  secure: true;
  username: string;
  password: string;
  from: string;
};

type Environment = Record<string, string | undefined>;

function entry(name: SmtpConfigurationEntry["name"], configured: boolean, valid: boolean, error: string | null): SmtpConfigurationEntry {
  return { name, configured, valid, error };
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function validHost(value: string | undefined) {
  return Boolean(value && value === value.trim() && !/\s/.test(value) && value.length <= 253);
}

function validPort(value: string | undefined) {
  if (!value || value !== value.trim() || !/^\d+$/.test(value)) return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function validFrom(value: string | undefined) {
  if (!value || value !== value.trim() || /[\r\n]/.test(value)) return false;
  const match = value.match(/^([^<>@\r\n]+) <([^<>\s@]+@[^<>\s@]+)>$/);
  return Boolean(match?.[1].trim() && match[2]);
}

/**
 * Server-only source of truth for SMTP validation and safe configuration diagnostics.
 * It deliberately returns no environment values, credentials, addresses, or connection details.
 */
export function inspectSmtpConfiguration(environment: Environment = process.env): SmtpConfigurationReport {
  const mode = environment.EMAIL_DELIVERY_MODE;
  const host = environment.SMTP_HOST;
  const port = environment.SMTP_PORT;
  const secure = environment.SMTP_SECURE;
  const username = environment.SMTP_USER;
  const password = environment.SMTP_PASSWORD;
  const from = environment.EMAIL_FROM;
  const production = environment.NODE_ENV === "production";

  const entries: SmtpConfigurationEntry[] = [
    entry("EMAIL_DELIVERY_MODE", hasText(mode), mode === "smtp", mode === "smtp" ? null : "Must be exactly smtp to enable SMTP diagnostics."),
    entry("SMTP_HOST", hasText(host), validHost(host), validHost(host) ? null : "Must be a non-empty hostname without whitespace."),
    entry("SMTP_PORT", hasText(port), validPort(port) !== null, validPort(port) !== null ? null : "Must be a whole number from 1 through 65535."),
    entry("SMTP_SECURE", hasText(secure), secure === "true", secure === "true" ? null : production ? "Must be exactly true in production." : "Must be exactly true; plaintext SMTP is not supported."),
    entry("SMTP_USER", hasText(username), hasText(username), hasText(username) ? null : "Must not be empty or whitespace only."),
    entry("SMTP_PASSWORD", hasText(password), hasText(password), hasText(password) ? null : "Must not be empty or whitespace only."),
    entry("EMAIL_FROM", hasText(from), validFrom(from), validFrom(from) ? null : "Must use Name <local-part@domain> format without line breaks."),
  ];

  return { entries, complete: entries.every((item) => item.valid) };
}

export function parseSmtpConfiguration(environment: Environment = process.env): SmtpConfiguration | null {
  const report = inspectSmtpConfiguration(environment);
  if (!report.complete) return null;

  return {
    host: environment.SMTP_HOST!,
    port: validPort(environment.SMTP_PORT)!,
    secure: true,
    username: environment.SMTP_USER!,
    password: environment.SMTP_PASSWORD!,
    from: environment.EMAIL_FROM!,
  };
}
