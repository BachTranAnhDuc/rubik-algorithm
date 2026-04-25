CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Immutable wrapper required because array_to_string is STABLE, not IMMUTABLE,
-- and GENERATED ALWAYS AS expressions require all functions to be IMMUTABLE.
CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE
  RETURN array_to_string(arr, sep);

ALTER TABLE algorithm_cases
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('english', immutable_array_to_string(coalesce(tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce("recognitionMd", '')), 'C')
  ) STORED;

CREATE INDEX algorithm_cases_search_vector_idx
  ON algorithm_cases USING GIN (search_vector);

CREATE INDEX algorithm_cases_name_trgm_idx
  ON algorithm_cases USING GIN (name gin_trgm_ops);

CREATE INDEX algorithm_cases_display_name_trgm_idx
  ON algorithm_cases USING GIN ("displayName" gin_trgm_ops);
