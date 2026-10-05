import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashShareToken } from '@/lib/tokens';
import { createViewerSession } from '@/lib/viewerSessions';

const SIGNED_URL_TTL_SECONDS = 300;

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  const dateOfBirth = String(body.dateOfBirth || '');

  if (!token || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const tokenHash = hashShareToken(token);
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent');

  const { data: share } = await admin
    .from('record_shares')
    .select(
      'id, status, attempt_count, max_attempts, expires_at, study_id, patients(date_of_birth), medical_record_files(storage_bucket, storage_path, file_name)'
    )
    .eq('token_hash', tokenHash)
    .single();

  if (!share) {
    return NextResponse.json({ ok: false, error: 'Enlace inválido.' }, { status: 404 });
  }

  if (share.status === 'revoked') {
    return NextResponse.json({ ok: false, error: 'Este enlace fue revocado.' }, { status: 410 });
  }

  if (share.status === 'downloaded') {
    return NextResponse.json(
      { ok: false, error: 'Este expediente ya fue descargado con este enlace.' },
      { status: 410 }
    );
  }

  if (share.status === 'locked' || share.attempt_count >= share.max_attempts) {
    return NextResponse.json(
      { ok: false, error: 'Se alcanzó el número máximo de intentos. Contacta a la clínica.' },
      { status: 429 }
    );
  }

  if (share.status === 'expired' || new Date(share.expires_at).getTime() < Date.now()) {
    if (share.status !== 'expired') {
      await admin.from('record_shares').update({ status: 'expired' }).eq('id', share.id);
    }
    return NextResponse.json({ ok: false, error: 'Este enlace expiró.' }, { status: 410 });
  }

  const patient = Array.isArray(share.patients) ? share.patients[0] : share.patients;
  const file = Array.isArray(share.medical_record_files)
    ? share.medical_record_files[0]
    : share.medical_record_files;

  const matches = patient?.date_of_birth === dateOfBirth;

  await admin.from('access_attempts').insert({
    share_id: share.id,
    success: matches,
    ip_address: ip,
    user_agent: userAgent,
  });

  if (!matches) {
    const newAttemptCount = share.attempt_count + 1;
    await admin
      .from('record_shares')
      .update({
        attempt_count: newAttemptCount,
        status: newAttemptCount >= share.max_attempts ? 'locked' : share.status,
      })
      .eq('id', share.id);

    return NextResponse.json({ ok: false, error: 'Fecha de nacimiento incorrecta.' }, { status: 401 });
  }

  if (share.study_id) {
    const viewerToken = await createViewerSession(share.id);
    if (!viewerToken) {
      return NextResponse.json({ ok: false, error: 'No se pudo preparar el visor.' }, { status: 500 });
    }

    const now = new Date().toISOString();
    await admin.from('record_shares').update({ status: 'viewed', viewed_at: now }).eq('id', share.id);

    await admin.from('audit_log').insert({
      actor_type: 'patient',
      action: 'verify_and_view_study',
      entity_type: 'record_shares',
      entity_id: share.id,
      ip_address: ip,
    });

    return NextResponse.json({ ok: true, kind: 'study', shareId: share.id, viewerToken });
  }

  const { data: signedUrlData, error: signedUrlError } = await admin.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData) {
    return NextResponse.json({ ok: false, error: 'No se pudo generar la descarga.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  await admin
    .from('record_shares')
    .update({ status: 'downloaded', viewed_at: now, downloaded_at: now })
    .eq('id', share.id);

  await admin.from('audit_log').insert({
    actor_type: 'patient',
    action: 'verify_and_download',
    entity_type: 'record_shares',
    entity_id: share.id,
    ip_address: ip,
  });

  return NextResponse.json({
    ok: true,
    kind: 'file',
    downloadUrl: signedUrlData.signedUrl,
    fileName: file.file_name,
  });
}
