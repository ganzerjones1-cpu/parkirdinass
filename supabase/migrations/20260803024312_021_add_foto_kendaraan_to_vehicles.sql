/*
# Add foto_kendaraan column to vehicles table

1. Changes to existing tables
- `vehicles`: add `foto_kendaraan` (text, nullable) — stores the public URL of the uploaded vehicle photo in Supabase Storage.
2. Storage
- Create bucket `vehicles` (public) for storing vehicle photos.
- Allow public read; allow authenticated insert/update/delete.
3. Security
- No RLS changes to `vehicles` table (existing policies still apply; the new column inherits the table's existing RLS).
- Storage bucket policies: public read, authenticated write.
*/

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS foto_kendaraan text;

-- Create the vehicles storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for vehicles bucket
DROP POLICY IF EXISTS "vehicles_bucket_public_read" ON storage.objects;
CREATE POLICY "vehicles_bucket_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vehicles');

-- Authenticated can upload/update to vehicles bucket
DROP POLICY IF EXISTS "vehicles_bucket_authed_insert" ON storage.objects;
CREATE POLICY "vehicles_bucket_authed_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicles');

DROP POLICY IF EXISTS "vehicles_bucket_authed_update" ON storage.objects;
CREATE POLICY "vehicles_bucket_authed_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicles')
WITH CHECK (bucket_id = 'vehicles');

DROP POLICY IF EXISTS "vehicles_bucket_authed_delete" ON storage.objects;
CREATE POLICY "vehicles_bucket_authed_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicles');
