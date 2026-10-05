import 'server-only';
import type { createClient } from './supabase/server';
import { generateShareToken } from './tokens';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SHARE_TTL_DAYS = 7;

export async function createShare(
  supabase: SupabaseServerClient,
  params: {
    patientId: string;
    doctorId: string;
    fileId?: string;
    studyId?: string;
    channel: 'email' | 'whatsapp';
  }
) {
  const { token, tokenHash } = generateShareToken();
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('record_shares')
    .insert({
      file_id: params.fileId ?? null,
      study_id: params.studyId ?? null,
      patient_id: params.patientId,
      created_by: params.doctorId,
      token_hash: tokenHash,
      channel: params.channel,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return { shareId: data.id, token };
}
