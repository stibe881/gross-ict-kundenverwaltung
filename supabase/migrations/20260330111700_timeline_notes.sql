-- migration: add notes to project milestones

ALTER TABLE public.project_milestones 
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_note_public BOOLEAN DEFAULT false;
