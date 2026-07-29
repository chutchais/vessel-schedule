-- A prior interrupted deployment may already have performed this enum rename.
-- Keep fresh installs and recovered databases on the same delivery-state vocabulary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum AS value
    INNER JOIN pg_type AS enum_type ON enum_type.oid = value.enumtypid
    WHERE enum_type.typname = 'InvitationDeliveryStatus'
      AND value.enumlabel = 'NOT_ATTEMPTED'
  ) THEN
    ALTER TYPE "InvitationDeliveryStatus" RENAME VALUE 'NOT_ATTEMPTED' TO 'PENDING';
  END IF;
END $$;
