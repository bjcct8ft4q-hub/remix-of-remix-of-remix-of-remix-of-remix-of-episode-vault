-- TMDB-backed season and episode catalogue metadata.
-- Existing episode rows and video paths are intentionally left untouched.
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS tmdb_id integer;

ALTER TABLE public.episode_catalog
  ADD COLUMN IF NOT EXISTS season_number integer,
  ADD COLUMN IF NOT EXISTS season_episode_number integer,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tmdb_episode_id integer;

CREATE UNIQUE INDEX IF NOT EXISTS episode_catalog_tmdb_episode_unique
  ON public.episode_catalog (series_id, tmdb_episode_id)
  WHERE tmdb_episode_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS episode_catalog_season_episode_unique
  ON public.episode_catalog (series_id, season_number, season_episode_number)
  WHERE season_number IS NOT NULL AND season_episode_number IS NOT NULL;
