-- Migration: Separate milestone_notes table for multiple notes per milestone
-- Replaces the inline notes/is_note_public columns on project_milestones

CREATE TABLE IF NOT EXISTS public.milestone_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    milestone_id UUID NOT NULL REFERENCES public.project_milestones(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.milestone_notes ENABLE ROW LEVEL SECURITY;

-- Allow full access to authenticated users
CREATE POLICY "Authenticated users can manage milestone notes"
    ON public.milestone_notes
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow anonymous read for public notes (for customer quote page)
CREATE POLICY "Anyone can read public milestone notes"
    ON public.milestone_notes
    FOR SELECT
    TO anon
    USING (is_public = true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS milestone_notes_milestone_id_idx ON public.milestone_notes(milestone_id);
