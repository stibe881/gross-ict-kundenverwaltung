-- Create accounting_years table
CREATE TABLE IF NOT EXISTS public.accounting_years (
    year INTEGER PRIMARY KEY,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.accounting_years ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Enable read access for all users" ON public.accounting_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for all users" ON public.accounting_years FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.accounting_years FOR UPDATE TO authenticated USING (true);

-- Enable realtime
alter publication supabase_realtime add table public.accounting_years;
