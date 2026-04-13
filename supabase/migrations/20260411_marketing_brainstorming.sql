create table if not exists "public"."marketing_brainstorming" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "category" text not null,
    "status" text not null default 'idea',
    "target_audience" text,
    "estimated_budget" numeric,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    primary key ("id")
);

-- Enable RLS
alter table "public"."marketing_brainstorming" enable row level security;

-- Policies for authenticated users
create policy "Enable full access for authenticated users on marketing_brainstorming"
on "public"."marketing_brainstorming"
as permissive
for all
to authenticated
using (true)
with check (true);
