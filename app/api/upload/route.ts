import { randomUUID, createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateShareToken } from '@/lib/tokens';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const SHARE_TTL_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1900 && date.getTime() <= Date.now();
}

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

  let patientId: string;
  let patientEmail: string | null;

  if (mode === 'existing') {
    patientId = String(form.get('patientId') || '');
    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'Falta el paciente seleccionado.' }, { status: 400 });
    }

    const emailOverride = String(form.get('emailOverride') || '').trim();

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, email')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ ok: false, error: 'Paciente no encontrado.' }, { status: 404 });
    }

    patientEmail = patient.email;

    if (!patientEmail && emailOverride) {
      if (!EMAIL_RE.test(emailOverride)) {
        return NextResponse.json({ ok: false, error: 'Correo del paciente inválido.' }, { status: 400 });
      }
      const { error: updateError } = await supabase
        .from('patients')
        .update({ email: emailOverride })
        .eq('id', patientId);
      if (updateError) {
        return NextResponse.json({ ok: false, error: 'No se pudo guardar el correo del paciente.' }, { status: 500 });
      }
      patientEmail = emailOverride;
    }
  } else {
    const fullName = String(form.get('fullName') || '').trim();
    const dateOfBirth = String(form.get('dateOfBirth') || '').trim();
    const email = String(form.get('email') || '').trim();

    if (!fullName || fullName.length < 3) {
      return NextResponse.json({ ok: false, error: 'Nombre del paciente inválido.' }, { status: 400 });
    }
    if (!isValidDateOfBirth(dateOfBirth)) {
      return NextResponse.json({ ok: false, error: 'Fecha de nacimiento inválida.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'Correo del paciente inválido.' }, { status: 400 });
    }

    const { data: newPatient, error: insertError } = await supabase
      .from('patients')
      .insert({ full_name: fullName, date_of_birth: dateOfBirth, email })
      .select('id, email')
      .single();

    if (insertError || !newPatient) {
      return NextResponse.json({ ok: false, error: 'No se pudo registrar al paciente.' }, { status: 500 });
    }

    patientId = newPatient.id;
    patientEmail = newPatient.email;
  }

  if (!patientEmail) {
    return NextResponse.json(
      { ok: false, error: 'El paciente no tiene correo registrado para el envío.' },
      { status: 400 }
    );
  }

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

  const { token, tokenHash } = generateShareToken();
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: shareRow, error: shareError } = await supabase
    .from('record_shares')
    .insert({
      file_id: fileRow.id,
      patient_id: patientId,
      created_by: user.id,
      token_hash: tokenHash,
      channel: 'email',
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (shareError || !shareRow) {
    return NextResponse.json({ ok: false, error: 'No se pudo generar el enlace seguro.' }, { status: 500 });
  }

  const admin = createAdminClient();
  await admin.from('audit_log').insert({
    actor_type: 'doctor',
    actor_id: user.id,
    action: 'upload_and_share',
    entity_type: 'medical_record_files',
    entity_id: fileRow.id,
    metadata: { patientId, shareId: shareRow.id, channel: 'email' },
  });

  const origin = new URL(request.url).origin;
  const secureLink = `${origin}/verificar/${token}`;

  return NextResponse.json({ ok: true, secureLink });
}
