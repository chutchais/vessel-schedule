export function isPlatformAdmin(platformRole: string | null | undefined) {
  return platformRole === "SUPER_ADMIN";
}
