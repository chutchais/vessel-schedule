import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!supabaseUrl || !supabaseSecretKey || !appUrl) {
    throw new Error("Missing required Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function inviteUserByEmail(email: string) {
  const admin = getAdminClient();
  return admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });
}

export async function inviteUserByEmailWithRedirect(email: string, redirectTo: string) {
  const admin = getAdminClient();
  return admin.auth.admin.inviteUserByEmail(email, { redirectTo });
}

export type ApprovalIdentityResult =
  | { ok: true; userId: string; outcome: "INVITED" | "ALREADY_EXISTS" }
  | { ok: false; category: "provider"; message: string };

async function findAuthUserByEmail(email: string) {
  const admin = getAdminClient();
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) return null;
    const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (result.data.users.length < 1000) return null;
  }
  return null;
}

export async function provisionApprovalIdentity(email: string): Promise<ApprovalIdentityResult> {
  const invited = await inviteUserByEmail(email);
  if (!invited.error && invited.data.user) {
    return { ok: true, userId: invited.data.user.id, outcome: "INVITED" };
  }

  const message = invited.error?.message.toLowerCase() ?? "";
  if (message.includes("already") || message.includes("exists") || message.includes("confirmed")) {
    const existing = await findAuthUserByEmail(email);
    if (existing) {
      return { ok: true, userId: existing.id, outcome: "ALREADY_EXISTS" };
    }
  }

  return {
    ok: false,
    category: "provider",
    message: "The authentication provider could not prepare the owner account",
  };
}
