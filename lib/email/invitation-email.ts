import "node:net";
import { inspectSmtpConfiguration, parseSmtpConfiguration } from "@/lib/email/smtp-configuration";

export type InvitationEmail = {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
  acceptanceUrl: string;
};

export type EmailDeliveryResult =
  | { ok: true }
  | { ok: false; category: "configuration" | "transport"; message: string };

export type EmailMessage = { to: string; subject: string; html: string; text: string; type: "organization-invitation" | "smtp-test" };
export type EmailTransport = { send(message: EmailMessage): Promise<void>; verify?: () => Promise<void> };

let testTransport: EmailTransport | null = null;

// Test-only seam: production code always resolves its transport from SMTP configuration.
export function setEmailTransportForTests(transport: EmailTransport | null) {
  testTransport = transport;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function headerValue(value: string) {
  return value.replace(/[\r\n]+/g, " ");
}

function invitationMessage(invitation: InvitationEmail): EmailMessage {
  const expiresAt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(invitation.expiresAt);
  const subject = headerValue(`You are invited to join ${invitation.organizationName}`);
  const text = `${invitation.inviterName} invited you to join ${invitation.organizationName} as ${invitation.role}. This invitation expires ${expiresAt} UTC. Accept: ${invitation.acceptanceUrl}`;
  return {
    to: invitation.to,
    subject,
    type: "organization-invitation",
    text,
    html: `<p>${escapeHtml(invitation.inviterName)} invited you to join <strong>${escapeHtml(invitation.organizationName)}</strong>.</p><p>Assigned role: <strong>${escapeHtml(invitation.role)}</strong></p><p>Expires: ${escapeHtml(expiresAt)} UTC</p><p><a href="${escapeHtml(invitation.acceptanceUrl)}">Accept invitation</a></p>`,
  };
}

function getTransport(): EmailTransport | EmailDeliveryResult {
  if (testTransport) return testTransport;
  const configuration = parseSmtpConfiguration();
  if (!configuration) {
    return { ok: false, category: "configuration", message: "SMTP configuration is incomplete" };
  }
  const { host, port, from, username, password } = configuration;
  return {
    async verify() {
      const { connect } = await import("node:tls");
      await new Promise<void>((resolve, reject) => {
        const socket = connect({ host, port, servername: host }, async () => {
          try {
            const read = () => new Promise<string>((done, fail) => { const onData = (data: Buffer) => { const reply = data.toString("utf8"); socket.off("error", onError); done(reply); }; const onError = (error: Error) => { socket.off("data", onData); fail(error); }; socket.once("data", onData); socket.once("error", onError); });
            const command = async (line: string) => { socket.write(`${line}\r\n`); const reply = await read(); if (!/^2|^3/.test(reply)) throw new Error("SMTP authentication failed"); };
            await read();
            await command("EHLO vessel-schedule");
            await command(`AUTH PLAIN ${Buffer.from(`\u0000${username}\u0000${password}`).toString("base64")}`);
            socket.end("QUIT\r\n");
            resolve();
          } catch (error) { socket.destroy(); reject(error); }
        });
        socket.setTimeout(15_000, () => { socket.destroy(); reject(new Error("SMTP connection timed out")); });
        socket.once("error", reject);
      });
    },
    async send(message) {
      const { connect } = await import("node:tls");
      await new Promise<void>((resolve, reject) => {
        const socket = connect({ host, port, servername: host }, async () => {
          try {
            const read = () => new Promise<string>((done, fail) => { const onData = (data: Buffer) => { const reply = data.toString("utf8"); socket.off("error", onError); done(reply); }; const onError = (error: Error) => { socket.off("data", onData); fail(error); }; socket.once("data", onData); socket.once("error", onError); });
            const command = async (line: string) => { socket.write(`${line}\r\n`); const reply = await read(); if (!/^2|^3/.test(reply)) throw new Error("SMTP rejected message"); };
            await read();
            await command("EHLO vessel-schedule");
            await command(`AUTH PLAIN ${Buffer.from(`\u0000${username}\u0000${password}`).toString("base64")}`);
            await command(`MAIL FROM:<${from}>`);
            await command(`RCPT TO:<${message.to}>`);
            await command("DATA");
            socket.write(`From: ${from}\r\nTo: ${message.to}\r\nSubject: ${message.subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=invite\r\n\r\n--invite\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${message.text}\r\n--invite\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${message.html}\r\n--invite--\r\n.\r\n`);
            const reply = await read(); if (!/^2/.test(reply)) throw new Error("SMTP rejected message");
            socket.end("QUIT\r\n"); resolve();
          } catch (error) { socket.destroy(); reject(error); }
        });
        socket.setTimeout(15_000, () => { socket.destroy(); reject(new Error("SMTP connection timed out")); });
        socket.once("error", reject);
      });
    },
  };
}

export { inspectSmtpConfiguration } from "@/lib/email/smtp-configuration";

export async function verifySmtpConnection(): Promise<EmailDeliveryResult> {
  const transport = getTransport();
  if ("ok" in transport) return transport;
  try {
    if (!transport.verify) return { ok: false, category: "configuration", message: "SMTP connection checks are unavailable" };
    await transport.verify();
    return { ok: true };
  }
  catch { return { ok: false, category: "transport", message: "The SMTP provider could not verify the connection" }; }
}

export async function sendSmtpTestEmail(input: { to: string; environment: string; appUrl: string; sentAt: Date }): Promise<EmailDeliveryResult> {
  const transport = getTransport();
  if ("ok" in transport) return transport;
  const timestamp = input.sentAt.toISOString();
  const text = `FlowPort SMTP test\n\nEnvironment: ${input.environment}\nApplication URL: ${input.appUrl}\nSent at: ${timestamp}`;
  try {
    await transport.send({
      to: input.to,
      subject: "FlowPort SMTP test",
      type: "smtp-test",
      text,
      html: `<p><strong>FlowPort SMTP test</strong></p><p>Environment: ${escapeHtml(input.environment)}</p><p>Application URL: ${escapeHtml(input.appUrl)}</p><p>Sent at: ${escapeHtml(timestamp)}</p>`,
    });
    return { ok: true };
  } catch { return { ok: false, category: "transport", message: "The SMTP provider could not send the test email" }; }
}

export async function deliverInvitationEmail(invitation: InvitationEmail): Promise<EmailDeliveryResult> {
  const transport = getTransport();
  if ("ok" in transport) return transport;
  try { await transport.send(invitationMessage(invitation)); return { ok: true }; }
  catch { return { ok: false, category: "transport", message: "The email provider could not deliver this invitation" }; }
}
