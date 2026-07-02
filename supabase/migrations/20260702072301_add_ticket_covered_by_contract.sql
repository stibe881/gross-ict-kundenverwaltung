ALTER TABLE "public"."tickets" ADD COLUMN IF NOT EXISTS "covered_by_contract" BOOLEAN DEFAULT false;
