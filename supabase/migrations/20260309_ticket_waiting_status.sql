-- Add "waiting" status to tickets table
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('open', 'in_progress', 'waiting', 'closed'));

-- Ensure ticket_comments has user_name column for admin comments
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
