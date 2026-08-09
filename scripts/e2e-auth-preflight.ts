import { config as loadEnv } from "dotenv";
import { assertDatabaseTarget, formatDatabaseTarget } from "../lib/db/target-guard";

loadEnv({ path: ".env.test.local", override: true });
loadEnv({ path: ".env.e2e.local", override: true });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function assertLocalHttpUrl(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required for E2E`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTP(S)`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${name} must target localhost/127.0.0.1`);
  }
  if (host.includes("supabase.co")) {
    throw new Error(`${name} must not target hosted Supabase`);
  }
  return `${host}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function main() {
  if (process.env.DATABASE_ENVIRONMENT !== "test") {
    throw new Error("DATABASE_ENVIRONMENT must be test for authentication E2E");
  }
  const target = assertDatabaseTarget({
    purpose: "integration-test",
    connectionUrl: requireEnv("DATABASE_URL"),
  });
  console.log(formatDatabaseTarget(target));
  console.log(
    `[e2e-supabase] url=${assertLocalHttpUrl(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    )}`,
  );
  console.log(`[e2e-app] url=${assertLocalHttpUrl("APP_URL", process.env.APP_URL)}`);
  requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  requireEnv("SUPABASE_SECRET_KEY");
  requireEnv("E2E_SUPABASE_TEST_PASSWORD");
}

main();
