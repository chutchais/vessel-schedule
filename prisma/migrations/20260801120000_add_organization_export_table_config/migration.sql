-- Add exportTableConfig column to organizations for configurable vessel-details export table.
ALTER TABLE "organizations" ADD COLUMN "exportTableConfig" JSONB;
