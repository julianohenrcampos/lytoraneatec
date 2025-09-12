-- Step 1: Enable extension and create normalization functions
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create text normalization function
CREATE OR REPLACE FUNCTION public.normalize_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(unaccent(coalesce(input_text, ''))));
$$;

-- Create email normalization function  
CREATE OR REPLACE FUNCTION public.normalize_email(input_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(input_email, '')));
$$;

-- Test the functions
SELECT 'Testing normalization functions...' as step;
SELECT 
  normalize_text('José Augusto Junior') as normalized_name,
  normalize_email('LytoRanea@2025gmail.com') as normalized_email;