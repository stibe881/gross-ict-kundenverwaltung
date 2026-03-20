-- Add user_id to expenses to track who uploaded the receipt
ALTER TABLE "public"."expenses" ADD COLUMN IF NOT EXISTS "user_id" UUID REFERENCES "public"."users"("id");

-- Optional Index for faster queries
CREATE INDEX IF NOT EXISTS "idx_expenses_user_id" ON "public"."expenses"("user_id");
