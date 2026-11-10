import { createClient } from '@supabase/supabase-js';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'receipts';

let supabaseClient: any = null;

if (supabaseUrl && supabaseKey) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
}

/**
 * Uploads a file buffer directly to Supabase Storage and returns the permanent public URL.
 * Falls back gracefully to null if Supabase is not configured or throws.
 */
export async function uploadToSupabase(
  fileBuffer: Buffer,
  originalFilename: string,
  mimetype: string
): Promise<string | null> {
  if (!supabaseClient) {
    console.warn('[Supabase Storage] Supabase credentials not found. Falling back to local storage.');
    return null;
  }

  try {
    const ext = path.extname(originalFilename).toLowerCase();
    const uniqueName = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(uniqueName, fileBuffer, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      console.error('[Supabase Storage] Upload error:', error);
      return null;
    }

    const { data: publicData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (err) {
    console.error('[Supabase Storage] Unexpected error uploading:', err);
    return null;
  }
}
