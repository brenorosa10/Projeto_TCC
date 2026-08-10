-- Astro initial schema
-- Backend ASP.NET uses a privileged connection string; RLS remains as defense in depth.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null check (role in ('professor', 'aluno')),
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code char(8) not null unique,
  professor_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists classes_code_idx on public.classes (code);
create index if not exists classes_professor_id_idx on public.classes (professor_id);

create table if not exists public.class_enrollments (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  type text not null check (type in ('quiz', 'prova', 'flashcards')),
  mode text not null default 'async' check (mode in ('live', 'async')),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  type text not null check (type in ('multiple_choice', 'true_false')),
  prompt text not null,
  explanation text,
  time_limit_seconds int not null default 30 check (time_limit_seconds > 0),
  position int not null default 0
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position int not null default 0
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  pin char(6) not null,
  status text not null default 'lobby',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists live_sessions_pin_idx on public.live_sessions (pin);

create table if not exists public.answer_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  live_session_id uuid references public.live_sessions (id) on delete set null,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean,
  response_time_ms int,
  score int,
  answered_at timestamptz not null default now()
);

create index if not exists answer_attempts_student_idx on public.answer_attempts (student_id);
create index if not exists answer_attempts_question_idx on public.answer_attempts (question_id);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_progress (
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  box_level int not null default 1 check (box_level between 1 and 5),
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (flashcard_id, student_id)
);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.activities enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.live_sessions enable row level security;
alter table public.answer_attempts enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_progress enable row level security;

-- Profiles: users can read/update themselves (writes of role go through API)
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own_safe"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- Classes: professor owns; enrolled students can read
create policy "classes_select_member"
  on public.classes for select
  using (
    professor_id = auth.uid()
    or exists (
      select 1 from public.class_enrollments e
      where e.class_id = classes.id and e.student_id = auth.uid()
    )
  );

create policy "classes_insert_professor"
  on public.classes for insert
  with check (
    professor_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
  );

create policy "enrollments_select_member"
  on public.class_enrollments for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.classes c
      where c.id = class_id and c.professor_id = auth.uid()
    )
  );

create policy "enrollments_insert_student"
  on public.class_enrollments for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'aluno'
    )
  );
