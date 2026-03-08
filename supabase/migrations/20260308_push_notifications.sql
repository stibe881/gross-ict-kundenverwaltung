-- Push Notifications Migration

-- 1. Add push_token to users (Admins/Employees)
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Add push_token to customer_portal_users (Customers)
ALTER TABLE customer_portal_users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 3. Modify notifications table to support customer_portal_users
-- Make user_id nullable since a notification could be for a customer instead of an internal user
ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;

-- Add the new relation column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_portal_user_id UUID REFERENCES customer_portal_users(id) ON DELETE CASCADE;

-- Update RLS for notifications so customers can see their own
CREATE POLICY "Customers can see their own notifications" ON notifications
  FOR SELECT USING (
    -- The user is authenticated and their email matches a customer portal user linked to this notification
    auth.role() = 'authenticated' AND 
    customer_portal_user_id IN (
      SELECT id FROM customer_portal_users WHERE id = auth.uid() OR email = (auth.jwt() ->> 'email')
    )
  );

-- Index for fast lookup by customer id
CREATE INDEX IF NOT EXISTS idx_notifications_customer_portal_user ON notifications(customer_portal_user_id);
