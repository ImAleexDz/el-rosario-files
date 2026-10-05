import 'server-only';
import { createAdminClient } from './supabase/admin';
import { generateShareToken, hashShareToken } from './tokens';

const VIEWER_SESSION_TTL_MINUTES = 30;

export async function createViewerSession(shareId: string) {
  const admin = createAdminClient();
  const { token, tokenHash } = generateShareToken();
  const expiresAt = new Date(Date.now() + VIEWER_SESSION_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await admin
    .from('viewer_sessions')
    .insert({ share_id: shareId, token_hash: tokenHash, expires_at: expiresAt });

  if (error) return null;
  return token;
}

export async function resolveViewerSession(shareId: string, token: string) {
  const admin = createAdminClient();
  const tokenHash = hashShareToken(token);

  const { data } = await admin
    .from('viewer_sessions')
    .select('id, expires_at')
    .eq('token_hash', tokenHash)
    .eq('share_id', shareId)
    .single();

  if (!data) return false;
  return new Date(data.expires_at).getTime() >= Date.now();
}
