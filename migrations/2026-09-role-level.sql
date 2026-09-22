-- =============================================================================
-- Store seniority level on postings (was derived at read-time only).
-- Apply in the Supabase SQL editor. Idempotent.
--
--   level         : IC track          Junior | Mid | Senior | Staff+
--                   Management track  Manager | Senior Manager | Director |
--                                     Senior Director | VP+
--                   (pipeline.classify_level; free text, no CHECK, so adding a
--                    tier is a code change plus backfill_levels.py — no DDL)
--   level_source  : 'explicit' (a real seniority signal was in the title) or
--                   'default' (fell through to Mid — no signal; never guessed).
--
-- The pipeline writes these at classify time once the columns exist (it probes
-- and strips them until then, so the scraper never breaks pre-migration).
-- backfill_levels.py backfills existing rows (levels only, idempotent);
-- reclassify_supabase.py also does it alongside a family re-write. The web read-time levelBucket
-- remains as a fallback for any row without a stored level.
-- =============================================================================
alter table job_postings add column if not exists level        text;
alter table job_postings add column if not exists level_source text;

create index if not exists job_postings_level_idx on job_postings (level);
