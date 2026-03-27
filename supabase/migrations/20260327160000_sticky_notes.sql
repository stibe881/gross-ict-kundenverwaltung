CREATE TABLE public.sticky_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    text TEXT DEFAULT '',
    color VARCHAR(50) DEFAULT 'yellow',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own sticky notes"
ON public.sticky_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sticky notes"
ON public.sticky_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sticky notes"
ON public.sticky_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sticky notes"
ON public.sticky_notes FOR DELETE
USING (auth.uid() = user_id);
