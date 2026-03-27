-- Make sticky notes accessible to all authenticated users
DROP POLICY IF EXISTS "notes_select_policy" ON public.sticky_notes;
DROP POLICY IF EXISTS "notes_insert_policy" ON public.sticky_notes;
DROP POLICY IF EXISTS "notes_update_policy" ON public.sticky_notes;
DROP POLICY IF EXISTS "notes_delete_policy" ON public.sticky_notes;

CREATE POLICY "notes_select_all" ON public.sticky_notes 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "notes_insert_all" ON public.sticky_notes 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notes_update_all" ON public.sticky_notes 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "notes_delete_all" ON public.sticky_notes 
FOR DELETE USING (auth.role() = 'authenticated');


-- Make tasks accessible to all authenticated users (fixes the smartphone RLS violation)
CREATE POLICY "tasks_allow_all_select" ON public.tasks 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tasks_allow_all_insert" ON public.tasks 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tasks_allow_all_update" ON public.tasks 
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "tasks_allow_all_delete" ON public.tasks 
FOR DELETE USING (auth.role() = 'authenticated');
