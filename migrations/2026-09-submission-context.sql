-- =============================================================================
-- Total-comp context on submissions, and role on leads.
-- Apply in the Supabase SQL editor. Idempotent.
--
-- The /add form asks for the exact advertised job title and, optionally, bonus,
-- equity and a free-text comment. These are stored SEPARATELY and are NEVER
-- blended into a base-salary median — base_eur remains the only field any
-- statistic reads. The extras exist so the admin reviewing a submission can see
-- the whole picture, and so we can later show "total comp context" as its own,
-- clearly-labelled thing.
--
--   exact_title  what the person's offer/contract actually calls the role. Feeds
--                classification (pipeline.classify_role / classify_level) the
--                same way an advertised title does.
--   bonus_eur    annual cash bonus, EUR. Context only.
--   equity_note  free text ("0.05% over 4 years", "RSUs ~€20k/yr"). Deliberately
--                text, not a number: equity is not comparable across companies
--                and a number here would invite exactly the false precision this
--                project refuses.
--   comments     anything else the submitter wants the reviewer to know.
--
-- The web app degrades gracefully if this has not been applied: the insert
-- retries with the core columns only, so a submission is never lost.
-- =============================================================================
alter table submissions add column if not exists exact_title text;
alter table submissions add column if not exists bonus_eur   double precision;
alter table submissions add column if not exists equity_note text;
alter table submissions add column if not exists comments    text;

-- Leads: which role family the person wants insights for. Set by the
-- post-submission opt-in ("Get salary insights for your role", source='insights').
alter table leads add column if not exists role text;
