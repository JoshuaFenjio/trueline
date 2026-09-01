-- =============================================================================
-- Role-request loop (growth feature). Apply in the Supabase SQL editor.
--
-- role_requests : a visitor asks us to track a role we don't yet label. Email
--                 is magic-link verified (no passwords). status flows:
--                 pending -> verified -> approved -> published (or rejected).
-- role_synonyms : admin-approved title synonyms -> role family. reclassify_supabase.py
--                 reads this so an approved request re-labels matching postings.
--
-- Both are written ONLY by server routes using the service key; RLS is enabled
-- with no anon policies, so nothing is readable/writable with the public key.
-- =============================================================================
create table if not exists role_requests (
    id              bigint generated always as identity primary key,
    query           text not null,             -- what the visitor typed
    query_norm      text not null,             -- lowercased, for dedupe/matching
    email           text not null,
    status          text default 'pending',    -- pending|verified|approved|published|rejected
    token           text not null,             -- magic-link verification token
    matching_n      integer default 0,         -- live postings whose title matched, at request time
    family_assigned text,                       -- set on approve
    created_at      timestamptz default now(),
    verified_at     timestamptz,
    notified_at     timestamptz
);
create index if not exists role_requests_status_idx on role_requests (status);
create index if not exists role_requests_qnorm_idx  on role_requests (query_norm);

create table if not exists role_synonyms (
    id         bigint generated always as identity primary key,
    synonym    text not null,                  -- lowercased title substring to match
    family     text not null,                  -- role family it maps to
    note       text,
    created_at timestamptz default now()
);
create unique index if not exists role_synonyms_uq on role_synonyms (synonym);

alter table role_requests enable row level security;   -- service-key only, no anon policies
alter table role_synonyms enable row level security;   -- service-key only, no anon policies
