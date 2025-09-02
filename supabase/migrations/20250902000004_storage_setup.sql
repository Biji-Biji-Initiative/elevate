-- Storage setup for evidence files

-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidence',
    'evidence',
    false, -- Private bucket
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Storage policies for evidence bucket
CREATE POLICY "evidence_upload_own" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'evidence' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "evidence_select_own" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'evidence' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR get_user_role(auth.uid()::text) IN ('REVIEWER', 'ADMIN', 'SUPERADMIN')
        )
    );

CREATE POLICY "evidence_delete_own" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'evidence' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Function to generate signed URLs for evidence files
CREATE OR REPLACE FUNCTION get_evidence_url(file_path TEXT)
RETURNS TEXT AS $$
DECLARE
    signed_url TEXT;
BEGIN
    -- Generate a signed URL valid for 1 hour
    SELECT INTO signed_url
        extensions.create_signed_url('evidence', file_path, 3600);
    
    RETURN signed_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;