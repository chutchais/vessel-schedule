import assert from "node:assert/strict";
import test from "node:test";
import { assertDatabaseTarget } from "./target-guard";

const local = {
  DATABASE_ENVIRONMENT: "test",
  DATABASE_URL: "postgresql://user:secret@127.0.0.1:55432/vessel_test",
  DIRECT_URL: "postgresql://user:other-secret@localhost:55432/vessel_test",
};

test("requires both database variables and an explicit classification", () => {
  assert.throws(() => assertDatabaseTarget({ purpose: "migration", env: {} }), /DATABASE_ENVIRONMENT/);
  assert.throws(
    () => assertDatabaseTarget({ purpose: "migration", env: { DATABASE_ENVIRONMENT: "local", DATABASE_URL: local.DATABASE_URL } }),
    /DIRECT_URL must be explicitly set/,
  );
});

test("accepts equivalent local targets without exposing credentials", () => {
  const target = assertDatabaseTarget({ purpose: "integration-test", env: local, connectionUrl: local.DATABASE_URL });
  assert.equal(target.databaseUrl, "127.0.0.1:55432/vessel_test");
  assert.equal(target.directUrl, "localhost:55432/vessel_test");
  assert.doesNotMatch(JSON.stringify(target), /secret/);
});

test("rejects mismatched hosts or databases without an exact pair approval", () => {
  assert.throws(
    () => assertDatabaseTarget({
      purpose: "migration",
      env: {
        DATABASE_ENVIRONMENT: "staging",
        DATABASE_URL: "postgresql://user:secret@pool.example.test:6543/app",
        DIRECT_URL: "postgresql://user:secret@direct.example.test:5432/other",
      },
    }),
    /do not resolve to the same approved host\/database/,
  );
});

test("rejects production for tests, seeds and benchmarks", () => {
  const env = {
    DATABASE_ENVIRONMENT: "production",
    DATABASE_URL: "postgresql://user:secret@db.example.test:6543/app",
    DIRECT_URL: "postgresql://user:secret@db.example.test:5432/app",
    DATABASE_TARGET_APPROVAL: "production@db.example.test:5432/app",
  };
  for (const purpose of ["integration-test", "seed", "benchmark", "explain"] as const) {
    assert.throws(() => assertDatabaseTarget({ purpose, env }), /refuses a production database target/);
  }
});

test("requires exact sanitized approval for remote classified targets", () => {
  const env = {
    DATABASE_ENVIRONMENT: "staging",
    DATABASE_URL: "postgresql://user:secret@db.example.test:6543/app",
    DIRECT_URL: "postgresql://user:secret@db.example.test:5432/app",
  };
  assert.throws(() => assertDatabaseTarget({ purpose: "migration", env }), /DATABASE_TARGET_APPROVAL/);
  assert.equal(
    assertDatabaseTarget({
      purpose: "migration",
      env: { ...env, DATABASE_TARGET_APPROVAL: "staging@db.example.test:5432/app" },
    }).environment,
    "staging",
  );
});
