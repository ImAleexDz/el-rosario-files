import { randomUUID, createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePatient } from '@/lib/patients';
import { createShare } from '@/lib/shares';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 });
  }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('is_active')
    .eq('id', user.id)
    .single();

  if (!doctor || !doctor.is_active) {
    return NextResponse.json({ ok: false, error: 'Cuenta no autorizada.' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const mode = form.get('mode');

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'No se recibió ningún archivo.' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ ok: false, error: 'Solo se aceptan archivos PDF.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: 'El archivo supera el límite de 20 MB.' }, { status: 400 });
  }

  const patientResult = await resolvePatient(supabase, {
    mode: mode === 'existing' ? 'existing' : 'new',
    patientId: String(form.get('patientId') || ''),
    emailOverride: String(form.get('emailOverride') || ''),
    fullName: String(form.get('fullName') || ''),
    dateOfBirth: String(form.get('dateOfBirth') || ''),
    email: String(form.get('email') || ''),
  });

  if (!patientResult.ok) {
    return NextResponse.json({ ok: false, error: patientResult.error }, { status: patientResult.status });
  }

  const { patientId } = patientResult;

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');
  const fileId = randomUUID();
  const storagePath = `${user.id}/${patientId}/${fileId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('expedientes-medicos')
    .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: 'No se pudo subir el archivo.' }, { status: 500 });
  }

  const { data: fileRow, error: fileError } = await supabase
    .from('medical_record_files')
    .insert({
      id: fileId,
      patient_id: patientId,
      doctor_id: user.id,
      file_name: file.name,
      storage_bucket: 'expedientes-medicos',
      storage_path: storagePath,
      checksum_sha256: checksum,
      file_size_bytes: file.size,
      mime_type: 'application/pdf',
      status: 'active',
    })
    .select('id')
    .single();

  if (fileError || !fileRow) {
    await supabase.storage.from('expedientes-medicos').remove([storagePath]);
    return NextResponse.json({ ok: false, error: 'No se pudo registrar el expediente.' }, { status: 500 });
  }

  const share = await createShare(supabase, {
    patientId,
    doctorId: user.id,
    fileId: fileRow.id,
    channel: 'email',
  });

  if (!share) {
    return NextResponse.json({ ok: false, error: 'No se pudo generar el enlace seguro.' }, { status: 500 });
  }

  const admin = createAdminClient();
  await admin.from('audit_log').insert({
    actor_type: 'doctor',
    actor_id: user.id,
    action: 'upload_and_share',
    entity_type: 'medical_record_files',
    entity_id: fileRow.id,
    metadata: { patientId, shareId: share.shareId, channel: 'email' },
  });

  const origin = new URL(request.url).origin;
  const secureLink = `${origin}/verificar/${share.token}`;

  return NextResponse.json({ ok: true, secureLink });
}
