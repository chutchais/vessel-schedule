import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InvitationList } from "@/components/invitations/invitation-list";

export default async function InvitationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/invitations");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <p className="text-lg font-semibold text-slate-900">Vessel Schedule</p>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <InvitationList />
      </main>
    </div>
  );
}
