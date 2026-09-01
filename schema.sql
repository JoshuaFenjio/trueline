-- =============================================================================
-- Trueline — Supabase/Postgres schema
-- Run this ONCE in the Supabase dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run (uses IF NOT EXISTS).
-- =============================================================================

-- Companies pulled by the scraper -------------------------------------------
create table if not exists companies (
    id          bigint generated always as identity primary key,
    name        text,
    ats         text,
    token       text,
    first_seen  timestamptz,
    last_seen   timestamptz,
    unique (ats, token)
);

-- Job postings (never deleted; expired ones kept as historical benchmarks) ---
create table if not exists job_postings (
    id              bigint generated always as identity primary key,
    company         text,
    ats             text,
    ats_job_id      text,
    title           text,
    role_family     text,
    location        text,
    city            text,
    country         text,
    remote          boolean,
    salary_min      double precision,
    salary_max      double precision,
    currency        text,
    salary_period   text,           -- year | month | hour
    salary_eur_min  double precision,
    salary_eur_max  double precision,
    salary_source   text,           -- structured | parsed | none
    posted_at       text,
    url             text,
    description     text,
    first_seen      timestamptz,
    last_seen       timestamptz,
    expired_at      timestamptz,
    status          text,           -- active | expired
    unique (ats, ats_job_id)
);

create index if not exists idx_jp_status       on job_postings (status);
create index if not exists idx_jp_role_family  on job_postings (role_family);
create index if not exists idx_jp_company      on job_postings (company);
create index if not exists idx_jp_city         on job_postings (city);

-- User-submitted salaries (reviewed by a human before they are ever used) ----
create table if not exists submissions (
    id          bigint generated always as identity primary key,
    role_family text,
    level       text,
    company     text,
    city        text,
    country     text,
    base_eur    double precision,
    proof_type  text,
    status      text default 'pending',   -- pending | approved | rejected
    created_at  timestamptz default now()
);

-- Waitlist / notify leads (employer waitlist + candidate benchmark-update).
create table if not exists leads (
    id          bigint generated always as identity primary key,
    email       text not null,
    company     text,
    source      text,           -- employer | candidate
    created_at  timestamptz default now()
);

-- =============================================================================
-- Row Level Security
-- The website reads with the ANON key and must ONLY see public, safe data.
-- All writes (migration, scraper) use the SERVICE key which bypasses RLS.
-- =============================================================================
alter table companies      enable row level security;
alter table job_postings   enable row level security;
alter table submissions    enable row level security;
alter table leads          enable row level security;

-- Anon may INSERT a lead (waitlist), but never read them.
drop policy if exists anon_insert_leads on leads;
create policy anon_insert_leads on leads
    for insert to anon with check (true);

-- Anon may READ companies and job postings (public benchmark data).
drop policy if exists anon_read_companies on companies;
create policy anon_read_companies on companies
    for select to anon using (true);

drop policy if exists anon_read_job_postings on job_postings;
create policy anon_read_job_postings on job_postings
    for select to anon using (true);

-- Anon may INSERT a submission (the /add form), always as 'pending'.
drop policy if exists anon_insert_submissions on submissions;
create policy anon_insert_submissions on submissions
    for insert to anon with check (status = 'pending');

-- Anon may READ only APPROVED submissions (a human reviewed them; anonymous,
-- never attributed). Pending/rejected rows stay private.
drop policy if exists anon_read_approved_submissions on submissions;
create policy anon_read_approved_submissions on submissions
    for select to anon using (status = 'approved');

-- =============================================================================
-- Role-request loop (see migrations/2026-09-role-requests.sql for the canonical,
-- comment-rich version). Service-key only; RLS on with no anon policies.
-- =============================================================================
create table if not exists role_requests (
    id              bigint generated always as identity primary key,
    query           text not null,
    query_norm      text not null,
    email           text not null,
    status          text default 'pending',   -- pending|verified|approved|published|rejected
    token           text not null,
    matching_n      integer default 0,
    family_assigned text,
    created_at      timestamptz default now(),
    verified_at     timestamptz,
    notified_at     timestamptz
);
create index if not exists role_requests_status_idx on role_requests (status);

create table if not exists role_synonyms (
    id         bigint generated always as identity primary key,
    synonym    text not null,
    family     text not null,
    note       text,
    created_at timestamptz default now()
);
create unique index if not exists role_synonyms_uq on role_synonyms (synonym);

alter table role_requests enable row level security;
alter table role_synonyms enable row level security;
