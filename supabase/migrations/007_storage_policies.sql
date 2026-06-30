-- ==============================================================================
-- 007_storage_policies.sql
-- Storage Policies for task-uploads bucket
-- ==============================================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-uploads', 'task-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for the storage.objects table
-- This table is owned by the Supabase Storage API, but we can manage policies

-- Enable RLS on storage.objects (if not already enabled)
-- NOTE: Supabase usually enables this by default, but just in case
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Allow public read access to all files in the task-uploads bucket
-- Since it's public, anyone can get the public URL and view the file.
CREATE POLICY "Public Read Access for task-uploads" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'task-uploads');

-- 2. Allow authenticated users to upload files
-- Both students (uploading task photos) and teachers (knowledge files) need this.
CREATE POLICY "Authenticated users can upload to task-uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'task-uploads' 
    AND auth.role() = 'authenticated'
);

-- 3. Allow users to update their own files
CREATE POLICY "Users can update own uploads in task-uploads" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'task-uploads' 
    AND auth.uid() = owner
);

-- 4. Allow users to delete their own files
CREATE POLICY "Users can delete own uploads in task-uploads" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'task-uploads' 
    AND auth.uid() = owner
);
