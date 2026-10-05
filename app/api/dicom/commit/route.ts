import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePatient, type PatientInput } from '@/lib/patients';
import { createShare } from '@/lib/shares';

type InstanceInput = {
  seriesInstanceUid: string;
  sopInstanceUid: string;
  instanceNumber: number | null;
  storagePath: string;
  fileSizeBytes: number;
};

// DICOM date (YYYYMMDD) -> YYYY-MM-DD, o null si no viene/está mal formado.
function toSqlDate(dicomDate: unknown): string | null {
  if (typeof dicomDate !== 'string' || !/^\d{8}$/.test(dicomDate)) return null;
  return `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;
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

  const body = await request.json().catch(() => ({}));
  const studyId = String(body.studyId || '');
  const studyInstanceUid = String(body.studyInstanceUid || '');
  const instances: InstanceInput[] = Array.isArray(body.instances) ? body.instances : [];
  const patientInput: PatientInput = body.patient || { mode: 'new' };

  if (!studyId || !studyInstanceUid) {
    return NextResponse.json({ ok: false, error: 'Estudio inválido.' }, { status: 400 });
  }
  if (instances.length === 0) {
    return NextResponse.json({ ok: false, error: 'El estudio no tiene imágenes.' }, { status: 400 });
  }

  const expectedPrefix = `${user.id}/${studyId}/`;
  const instancesValid = instances.every(
    (i) =>
      typeof i.storagePath === 'string' &&
      i.storagePath.startsWith(expectedPrefix) &&
      typeof i.seriesInstanceUid === 'string' &&
      typeof i.sopInstanceUid === 'string' &&
      typeof i.fileSizeBytes === 'number'
  );
  if (!instancesValid) {
    return NextResponse.json({ ok: false, error: 'Imágenes del estudio inválidas.' }, { status: 400 });
  }

  const patientResult = await resolvePatient(supabase, patientInput);
  if (!patientResult.ok) {
    return NextResponse.json({ ok: false, error: patientResult.error }, { status: patientResult.status });
  }
  const { patientId } = patientResult;

  const { data: studyRow, error: studyError } = await supabase
    .from('dicom_studies')
    .insert({
      id: studyId,
      patient_id: patientId,
      doctor_id: user.id,
      study_instance_uid: studyInstanceUid,
      modality: body.modality || null,
      study_description: body.studyDescription || null,
      study_date: toSqlDate(body.studyDate),
      status: 'active',
    })
    .select('id')
    .single();

  if (studyError || !studyRow) {
    return NextResponse.json({ ok: false, error: 'No se pudo registrar el estudio.' }, { status: 500 });
  }

  const { error: instancesError } = await supabase.from('dicom_instances').insert(
    instances.map((i) => ({
      study_id: studyId,
      series_instance_uid: i.seriesInstanceUid,
      sop_instance_uid: i.sopInstanceUid,
      instance_number: i.instanceNumber,
      storage_bucket: 'estudios-dicom',
      storage_path: i.storagePath,
      file_size_bytes: i.fileSizeBytes,
    }))
  );

  if (instancesError) {
    await supabase.storage.from('estudios-dicom').remove(instances.map((i) => i.storagePath));
    await supabase.from('dicom_studies').delete().eq('id', studyId);
    return NextResponse.json({ ok: false, error: 'No se pudieron registrar las imágenes.' }, { status: 500 });
  }

  const share = await createShare(supabase, {
    patientId,
    doctorId: user.id,
    studyId,
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
    entity_type: 'dicom_studies',
    entity_id: studyId,
    metadata: { patientId, shareId: share.shareId, channel: 'email', instanceCount: instances.length },
  });

  const origin = new URL(request.url).origin;
  const secureLink = `${origin}/verificar/${share.token}`;

  return NextResponse.json({ ok: true, secureLink });
}
