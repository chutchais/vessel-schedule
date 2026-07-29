-- Copyable invitation URLs are bearer credentials. Only their SHA-256 digest is persisted.
ALTER TABLE "organization_invitations"
ADD COLUMN "tokenHash" CHAR(64);

-- Existing email-delivery invitations cannot be converted into URL credentials.
-- Mark them revoked rather than inventing or storing a recoverable token.
UPDATE "organization_invitations"
SET "status" = 'REVOKED',
    "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
    "pendingKey" = NULL
WHERE "tokenHash" IS NULL AND "status" = 'PENDING';

-- A non-recoverable random digest satisfies the new required column for legacy
-- records. Since their raw bearer value never existed, they cannot be accepted.
UPDATE "organization_invitations"
SET "tokenHash" = encode(gen_random_bytes(32), 'hex')
WHERE "tokenHash" IS NULL;

ALTER TABLE "organization_invitations"
ALTER COLUMN "tokenHash" SET NOT NULL;

CREATE UNIQUE INDEX "organization_invitations_tokenHash_key"
ON "organization_invitations"("tokenHash");
