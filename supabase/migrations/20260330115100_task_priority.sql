-- Add priority field to project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
