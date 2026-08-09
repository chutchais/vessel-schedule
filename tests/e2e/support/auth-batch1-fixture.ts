import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertDatabaseTarget } from "../../../lib/db/target-guard";

type OrgRole = "OWNER" | "ADMIN" | "PLANNER" | "VIEWER";
type PlatformRole = "USER" | "SUPER_ADMIN";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type E2EUser = {
  id: string;
  email: string;
  password: string;
  displayName: string;
};

export type E2EOrg = {
  id: string;
  name: string;
  slug: string;
};

type SupabaseAdminUser = { id: string; email: string };

function parseLocalUrl(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required`);
  const parsed = new URL(value);
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${name} must be localhost/127.0.0.1`);
  }
  if (parsed.hostname.toLowerCase().includes("supabase.co")) {
    throw new Error(`${name} must not target hosted Supabase`);
  }
  return parsed;
}

export class AuthBatch1Fixture {
  readonly runId = `e2e-auth-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  readonly emailPrefix = `${this.runId}`.toLowerCase();
  readonly defaultPassword = process.env.E2E_SUPABASE_TEST_PASSWORD ?? "ChangeMe-local-only-123!";
  readonly baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3201";

  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private readonly supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  private readonly supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;
  private readonly createdSupabaseUsers = new Set<string>();

  assertEnvironment() {
    if (process.env.DATABASE_ENVIRONMENT !== "test") {
      throw new Error("DATABASE_ENVIRONMENT must be test for E2E");
    }
    assertDatabaseTarget({
      purpose: "integration-test",
      connectionUrl: process.env.DATABASE_URL,
    });

    const reference = new URL(process.env.DATABASE_URL!);
    for (const key of [
      "DIRECT_URL",
      "RB1_TEST_DATABASE_URL",
      "RB2_TEST_DATABASE_URL",
      "RB3_TEST_DATABASE_URL",
    ] as const) {
      const value = process.env[key];
      if (!value) throw new Error(`${key} is required`);
      const parsed = new URL(value);
      const local = LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
      if (!local) throw new Error(`${key} must target localhost/127.0.0.1`);
      const refIdentity = `${reference.hostname}:${reference.port || "5432"}${reference.pathname}`;
      const curIdentity = `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
      if (curIdentity !== refIdentity) {
        throw new Error(`${key} must resolve to the same local database as DATABASE_URL`);
      }
    }

    parseLocalUrl("APP_URL", process.env.APP_URL);
    parseLocalUrl("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
    parseLocalUrl("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
    }
    if (!process.env.SUPABASE_SECRET_KEY) {
      throw new Error("SUPABASE_SECRET_KEY is required");
    }
  }

  async createOrganization(label: string): Promise<E2EOrg> {
    const slug = `${this.emailPrefix}-${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
    const name = `${this.runId}-${label}`;
    const result = await this.pool.query<{ id: string; name: string; slug: string }>(
      "insert into organizations (id, name, slug, \"isActive\", \"createdAt\", \"updatedAt\") values (gen_random_uuid(), $1, $2, true, now(), now()) returning id, name, slug",
      [name, slug],
    );
    return result.rows[0];
  }

  async createUser(
    label: string,
    options: {
      platformRole?: PlatformRole;
      password?: string;
      email?: string;
      confirmed?: boolean;
    } = {},
  ): Promise<E2EUser> {
    const password = options.password ?? this.defaultPassword;
    const email =
      options.email ??
      `${this.emailPrefix}-${label}-${randomUUID().slice(0, 8)}@example.test`.toLowerCase();
    const displayName = `${this.runId}-${label}`;
    const authUser = await this.createSupabaseUser(email, password, displayName, options.confirmed ?? true);

    await this.pool.query(
      `insert into users (id, email, "displayName", "platformRole", "isActive", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, true, now(), now())
       on conflict (id) do update
         set email = excluded.email,
             "displayName" = excluded."displayName",
             "platformRole" = excluded."platformRole",
             "isActive" = true,
             "updatedAt" = now()`,
      [authUser.id, email, displayName, options.platformRole ?? "USER"],
    );

    return { id: authUser.id, email, password, displayName };
  }

  async addMembership(userId: string, organizationId: string, role: OrgRole) {
    await this.pool.query(
      `insert into organization_members ("organizationId", "userId", role, "isActive", "joinedAt", "updatedAt")
       values ($1, $2, $3, true, now(), now())
       on conflict ("organizationId", "userId") do update
         set role = excluded.role,
             "isActive" = true,
             "updatedAt" = now()`,
      [organizationId, userId, role],
    );
  }

  async createCompany(organizationId: string, code: string, name: string) {
    const result = await this.pool.query<{ id: string; code: string; name: string }>(
      `insert into companies (id, code, name, type, "isActive", "organizationId", "createdAt", "updatedAt")
       values (gen_random_uuid(), $1, $2, 'SHIPPING_LINE', true, $3, now(), now())
       returning id, code, name`,
      [code, name, organizationId],
    );
    return result.rows[0];
  }

  async createOrganizationRequest(options: {
    organizationName: string;
    requesterName: string;
    requesterEmail: string;
  }) {
    const result = await this.pool.query<{ id: string }>(
      `insert into organization_requests
       (id, "organizationName", "requesterName", "requesterEmail", status, "approvalVersion", "createdAt", "updatedAt")
       values (concat('e2e', replace(gen_random_uuid()::text, '-', '')), $1, $2, $3, 'PENDING', 0, now(), now())
       returning id`,
      [options.organizationName, options.requesterName, options.requesterEmail.toLowerCase()],
    );
    return result.rows[0];
  }

  async getOrganizationRequestStatus(organizationName: string) {
    const result = await this.pool.query<{ status: string }>(
      `select status from organization_requests
       where "organizationName" = $1
       order by "createdAt" desc
       limit 1`,
      [organizationName],
    );
    return result.rows[0]?.status ?? null;
  }

  async membershipCount(userId: string, organizationId: string) {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count
       from organization_members
       where "userId" = $1 and "organizationId" = $2 and "isActive" = true`,
      [userId, organizationId],
    );
    return Number(result.rows[0]?.count ?? "0");
  }

  async findUserIdByEmail(email: string) {
    const result = await this.pool.query<{ id: string }>(
      `select id from users where email = $1 limit 1`,
      [email.toLowerCase()],
    );
    return result.rows[0]?.id ?? null;
  }

  async confirmUserByEmail(email: string) {
    const user = await this.findSupabaseUserByEmail(email);
    if (!user) throw new Error("Supabase user not found for confirmation");
    const response = await this.supabaseAdminFetch(`/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ email_confirm: true }),
    });
    if (!response.ok) throw new Error("Failed to confirm Supabase user");
  }

  async dispose() {
    const orgRows = await this.pool.query<{ id: string }>(
      `select id from organizations where slug like $1`,
      [`${this.emailPrefix}%`],
    );
    const orgIds = orgRows.rows.map((row) => row.id);

    if (orgIds.length > 0) {
      await this.pool.query(`delete from audit_logs where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from planner_undos where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from vessel_schedules where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from organization_invitations where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from organization_members where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from services where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from vessels where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from berths where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from terminals where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from ports where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(`delete from companies where "organizationId" = any($1::uuid[])`, [orgIds]);
      await this.pool.query(
        `delete from organization_requests
         where "organizationId" = any($1::uuid[])
            or "organizationName" like $2
            or "requesterEmail" like $3`,
        [orgIds, `${this.runId}%`, `${this.emailPrefix}%`],
      );
      await this.pool.query(`delete from organizations where id = any($1::uuid[])`, [orgIds]);
    }

    await this.pool.query(`delete from users where email like $1`, [`${this.emailPrefix}%`]);

    for (const userId of this.createdSupabaseUsers) {
      await this.supabaseAdminFetch(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
    }
    await this.pool.end();
  }

  private async createSupabaseUser(
    email: string,
    password: string,
    displayName: string,
    confirmed: boolean,
  ): Promise<SupabaseAdminUser> {
    const response = await this.supabaseAdminFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: confirmed,
        user_metadata: { display_name: displayName },
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to create local Supabase test user");
    }
    const payload = (await response.json()) as { user?: { id?: string; email?: string } };
    const id = payload.user?.id;
    if (!id) throw new Error("Supabase create user response missing id");
    this.createdSupabaseUsers.add(id);
    return { id, email };
  }

  private async findSupabaseUserByEmail(email: string) {
    const normalized = email.toLowerCase();
    for (let page = 1; page <= 10; page += 1) {
      const response = await this.supabaseAdminFetch(`/auth/v1/admin/users?page=${page}&per_page=1000`, {
        method: "GET",
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { users?: Array<{ id: string; email?: string }> };
      const user = payload.users?.find((candidate) => candidate.email?.toLowerCase() === normalized);
      if (user) return user;
      if (!payload.users || payload.users.length < 1000) return null;
    }
    return null;
  }

  private async supabaseAdminFetch(path: string, options: { method: string; body?: string }) {
    return fetch(`${this.supabaseUrl}${path}`, {
      method: options.method,
      headers: {
        apikey: this.supabaseServiceKey,
        Authorization: `Bearer ${this.supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: options.body,
    });
  }
}
