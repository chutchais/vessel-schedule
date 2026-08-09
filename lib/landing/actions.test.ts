import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { getLandingActions } from "./actions";

test("landing actions preserve request-access and sign-in routes", () => {
  const actions = getLandingActions(true);
  assert.deepEqual(actions.primary, { label: "Request Access", href: "/request-access" });
  assert.deepEqual(actions.secondary, { label: "Sign In", href: "/login" });
  assert.equal(actions.setup, null);
});

test("first-time setup appears only when no platform admin exists", () => {
  assert.deepEqual(getLandingActions(false).setup, {
    label: "Set Up Platform",
    href: "/request-access?setup=platform",
  });
  assert.equal(getLandingActions(true).setup, null);
});

test("landing page presents the MVP without unsupported product claims", async () => {
  const page = await readFile(resolve(process.cwd(), "app/(public)/page.tsx"), "utf8");
  assert.match(page, /Plan Berth Operations with Confidence/);
  assert.match(page, /Secure read-only planner sharing|secure sharing/i);
  assert.match(page, /invite-only MVP pilot/i);
  assert.match(page, /does not claim enterprise readiness, guaranteed uptime/i);
  assert.doesNotMatch(page, /customer testimonial|enterprise-ready|real-time synchronization/i);
});
