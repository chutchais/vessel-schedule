import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("FlowPort wordmark preserves the V1 text treatment and accessible name", async () => {
  const logo = await readFile(resolve(process.cwd(), "components/brand/flowport-logo.tsx"), "utf8");
  assert.match(logo, /aria-label="FlowPort"/);
  assert.match(logo, /#0b3b5c/);
  assert.match(logo, /#2d7a9b/);
  assert.match(logo, /Flow<span[^>]*>Port<\/span>/);
  assert.match(logo, /getflowport\.com/);
  assert.doesNotMatch(logo, /<img|localhost/i);
});

test("FlowPort branding is shared across public, auth, and application shells", async () => {
  const paths = [
    "app/(public)/_components/landing-header.tsx",
    "app/(public)/page.tsx",
    "app/(auth)/login/page.tsx",
    "app/(auth)/request-access/page.tsx",
    "components/ui/sidebar-navigation.tsx",
    "components/ui/mobile-navigation.tsx",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(resolve(process.cwd(), path), "utf8")));
  for (const source of sources) assert.match(source, /FlowPortLogo/);
  assert.match(sources[4]!, /FlowPortLogo compact showDomain=\{false\}/);
  assert.match(sources[5]!, /FlowPortLogo compact showDomain=\{false\}/);
});

test("landing metadata uses the production FlowPort canonical identity", async () => {
  const page = await readFile(resolve(process.cwd(), "app/(public)/page.tsx"), "utf8");
  assert.match(page, /title: "FlowPort \| Berth Planning"/);
  assert.match(page, /description: "Visual berth planning for modern terminal operations\."/);
  assert.match(page, /canonical: "https:\/\/getflowport\.com"/);
  assert.doesNotMatch(page, /localhost/i);
});
