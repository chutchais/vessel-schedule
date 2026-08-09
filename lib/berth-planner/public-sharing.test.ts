import test from "node:test";
import assert from "node:assert/strict";
import { buildShareUrl, createPublicId, createSecret, hashToken, parseShareDateRange, PUBLIC_VESSEL_LABEL_CONFIG, tokenMatches, validateShareFilters } from "./public-sharing";

test("share secrets have 256 bits of entropy and only hashes need persistence", () => {
  const first = createSecret(); const second = createSecret();
  assert.equal(Buffer.from(first.secret, "base64url").length, 32);
  assert.equal(first.hash.length, 64);
  assert.equal(first.hash, hashToken(first.secret));
  assert.equal(tokenMatches(first.secret, first.hash), true);
  assert.equal(tokenMatches(second.secret, first.hash), false);
  assert.notEqual(first.secret, second.secret);
});

test("share URLs keep the secret in the fragment", () => {
  const url = buildShareUrl("https://planner.example", "public-id", "raw-secret");
  assert.equal(url, "https://planner.example/shared/berth-planner/public-id#raw-secret");
  assert.equal(new URL(url).search, "");
  assert.equal(new URL(url).hash, "#raw-secret");
  assert.ok(createPublicId().length >= 20);
});

test("share date ranges are calendar-day bounded in the port timezone", () => {
  const valid = parseShareDateRange("2026-03-01", "2026-03-31", "Asia/Bangkok");
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.rangeStart.toISOString(), "2026-02-28T17:00:00.000Z");
    assert.equal(valid.rangeEnd.toISOString(), "2026-03-31T17:00:00.000Z");
  }
  assert.equal(parseShareDateRange("2026-03-01", "2026-04-01", "UTC").ok, false);
  assert.equal(parseShareDateRange("bad", "2026-03-01", "UTC").ok, false);
});

test("filters reject foreign berths and bound public strings", () => {
  assert.equal(validateShareFilters({ berthId: "foreign" }, new Set(["allowed"])).ok, false);
  const result = validateShareFilters({ berthId: "allowed", search: "x".repeat(150), status: "PLANNED", conflictsOnly: true }, new Set(["allowed"]));
  assert.equal(result.ok, true);
  if (result.ok) { assert.equal(result.filters.search.length, 100); assert.equal(result.filters.status, "PLANNED"); }
});

test("external labels contain no private placeholders or executable markup", () => {
  const templates = PUBLIC_VESSEL_LABEL_CONFIG.lines.map((line) => line.template).join(" ");
  assert.doesNotMatch(templates, /remarks|updatedAt|<|javascript:/i);
});
