export type EmailDeliveryMode = "disabled" | "smtp";

export function getEmailDeliveryMode(): EmailDeliveryMode {
  return process.env.EMAIL_DELIVERY_MODE === "smtp" ? "smtp" : "disabled";
}

export function emailDeliveryEnabled() {
  return getEmailDeliveryMode() === "smtp";
}

export const EMAIL_DELIVERY_UNAVAILABLE_MESSAGE =
  "Email delivery is unavailable. Invitation email actions are disabled.";
