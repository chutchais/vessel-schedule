export type LandingAction = { label: string; href: string };

export function getLandingActions(hasPlatformAdmin: boolean): {
  primary: LandingAction;
  secondary: LandingAction;
  setup: LandingAction | null;
} {
  return {
    primary: { label: "Request Access", href: "/request-access" },
    secondary: { label: "Sign In", href: "/login" },
    setup: hasPlatformAdmin ? null : { label: "Set Up Platform", href: "/request-access?setup=platform" },
  };
}
