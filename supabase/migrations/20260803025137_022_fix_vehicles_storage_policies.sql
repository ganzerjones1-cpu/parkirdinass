/*
# Fix vehicles storage bucket policies

The vehicles storage bucket needs policies that allow authenticated users
to upload files. The previous policies may not have been applied correctly.
This migration drops and recreates all storage policies for the vehicles bucket.
*/

-- Recreate vehicles bucket ensuring it exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop all existing policies for vehicles bucket objects
DROP POLICY IF EXISTS "vehicles_bucket_public_read" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_bucket_authed_insert" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_bucket_authed_update" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_bucket_authed_delete" ON storage.objects;

-- Public read (anon + authenticated)
CREATE POLICY "vehicles_bucket_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vehicles');

-- Authenticated upload
CREATE POLICY "vehicles_bucket_authed_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicles');

-- Authenticated update (upsert)
CREATE POLICY "vehicles_bucket_authed_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicles')
WITH CHECK (bucket_id = 'vehicles');

-- Authenticated delete
CREATE POLICY "vehicles_bucket_authed_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicles');
