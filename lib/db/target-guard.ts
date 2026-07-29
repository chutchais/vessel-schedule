export type DatabaseEnvironment = "local" | "test" | "development" | "staging" | "production";
export type DatabasePurpose = "prisma" | "migration" | "integration-test" | "seed" | "benchmark" | "explain" | "bootstrap";

type GuardEnvironment = Record<string, string | undefined>;

export type SanitizedDatabaseTarget = {
  environment: DatabaseEnvironment;
  databaseUrl: string;
  directUrl: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const FORBID_PRODUCTION = new Set<DatabasePurpose>(["integration-test", "seed", "benchmark", "explain"]);

function parseEnvironment(value: string | undefined): DatabaseEnvironment {
  if (value === "local" || value === "test" || value === "development" || value === "staging" || value === "production") {
    return value;
  }
  throw new Error("DATABASE_ENVIRONMENT must be explicitly set to local, test, development, staging, or production");
}

function parseTarget(name: string, raw: string | undefined) {
  if (!raw) throw new Error(`${name} must be explicitly set; implicit .env fallback is disabled`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid database URL`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${name} must use PostgreSQL`);
  }
  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!host || !database) throw new Error(`${name} must include a host and database`);
  const port = url.port || "5432";
  return {
    host,
    database,
    local: LOCAL_HOSTS.has(host),
    sanitized: `${host}:${port}/${database}`,
    identity: `${host}/${database}`,
  };
}

export function assertDatabaseTarget(options: {
  purpose: DatabasePurpose;
  connectionUrl?: string;
  env?: GuardEnvironment;
}): SanitizedDatabaseTarget {
  const source = options.env ?? process.env;
  const environment = parseEnvironment(source.DATABASE_ENVIRONMENT);
  const application = parseTarget("DATABASE_URL", source.DATABASE_URL);
  const direct = parseTarget("DIRECT_URL", source.DIRECT_URL);

  const sameLocalDatabase = application.local && direct.local && application.database === direct.database;
  const sameRemoteDatabase = application.identity === direct.identity;
  const pair = `${application.sanitized}|${direct.sanitized}`;
  if (!sameLocalDatabase && !sameRemoteDatabase && source.DATABASE_TARGET_PAIR_APPROVAL !== pair) {
    throw new Error(
      `DATABASE_URL (${application.sanitized}) and DIRECT_URL (${direct.sanitized}) do not resolve to the same approved host/database`,
    );
  }

  if ((environment === "local" || environment === "test") && (!application.local || !direct.local)) {
    throw new Error(`${environment} database targets must be local`);
  }
  if (FORBID_PRODUCTION.has(options.purpose) && environment === "production") {
    throw new Error(`${options.purpose} refuses a production database target`);
  }
  if ((environment === "staging" || environment === "production" || (environment === "development" && !direct.local))) {
    const expectedApproval = `${environment}@${direct.sanitized}`;
    if (source.DATABASE_TARGET_APPROVAL !== expectedApproval) {
      throw new Error(`Set DATABASE_TARGET_APPROVAL=${expectedApproval} to approve this sanitized target`);
    }
  }

  if (options.connectionUrl) {
    const connection = parseTarget("command connection URL", options.connectionUrl);
    const matchesApplication = connection.identity === application.identity || (connection.local && application.local && connection.database === application.database);
    if (!matchesApplication) {
      throw new Error(`Command connection target ${connection.sanitized} does not match DATABASE_URL ${application.sanitized}`);
    }
  }

  return {
    environment,
    databaseUrl: application.sanitized,
    directUrl: direct.sanitized,
  };
}

export function formatDatabaseTarget(target: SanitizedDatabaseTarget) {
  return `[database-target] environment=${target.environment} DATABASE_URL=${target.databaseUrl} DIRECT_URL=${target.directUrl}`;
}
