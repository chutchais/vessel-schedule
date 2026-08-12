"use client";

import { useState } from "react";
import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";

type Status = Record<"host" | "port" | "secure" | "username" | "password" | "senderEmail" | "senderName", boolean>;
const LABELS: Array<[keyof Status, string]> = [["host", "SMTP host"], ["port", "SMTP port"], ["secure", "Secure/TLS mode"], ["username", "SMTP username"], ["password", "SMTP password"], ["senderEmail", "Sender email"], ["senderName", "Sender name"]];

export function SmtpConfigurationManager({ configuration, complete, destination }: { configuration: Status; complete: boolean; destination: string }) {
  const [running, setRunning] = useState<"check" | "send-test" | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function run(action: "check" | "send-test") {
    if (action === "send-test" && !window.confirm(`Send the SMTP test email only to your verified account: ${destination}?`)) return;
    setRunning(action); setNotice(null);
    try {
      const res = await fetch("/api/platform-administration/smtp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), cache: "no-store" });
      const payload = await res.json() as { data?: { success: boolean; message: string }; error?: string };
      const message = payload.data?.message ?? payload.error ?? "SMTP diagnostics could not be completed.";
      setNotice({ type: res.ok && payload.data?.success ? "success" : "error", message });
    } catch { setNotice({ type: "error", message: "SMTP diagnostics could not be completed." }); }
    finally { setRunning(null); }
  }

  const disabledReason = "SMTP configuration is incomplete. Update production environment settings and redeploy before testing.";
  return <div className="space-y-6">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">SMTP Configuration Status</h2><p className="mt-1 text-sm text-slate-600">Only configuration presence is shown; values and credentials are never displayed.</p><dl className="mt-5 divide-y divide-slate-100">{LABELS.map(([key, label]) => <div key={key} className="flex items-center justify-between py-3 text-sm"><dt className="text-slate-700">{label}</dt><dd className={configuration[key] ? "font-medium text-emerald-700" : "font-medium text-red-700"}>{configuration[key] ? "Configured" : "Missing"}</dd></div>)}</dl></section>
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">SMTP Diagnostics</h2><p className="mt-1 text-sm text-slate-600">Configuration values must be changed through production environment settings and an application redeployment. For help, contact <a className="text-blue-600 underline" href="mailto:support@getflowport.com">support@getflowport.com</a>.</p><div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => void run("check")} disabled={!complete || running !== null}>{running === "check" ? "Checking…" : "Check SMTP Connection"}</Button><Button variant="secondary" onClick={() => void run("send-test")} disabled={!complete || running !== null}>{running === "send-test" ? "Sending…" : "Send Test Email"}</Button></div><p className="mt-3 text-sm text-slate-600">Test email destination: <strong>{destination}</strong>. No other recipient can be selected.</p>{!complete ? <p className="mt-2 text-sm text-amber-700">{disabledReason}</p> : null}{notice ? <div className="mt-4"><AlertMessage type={notice.type} message={notice.message} /></div> : null}</section>
  </div>;
}
