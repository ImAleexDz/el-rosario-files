import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveViewerSession } from '@/lib/viewerSessions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';

  if (!token || !(await resolveViewerSession(shareId, token))) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: share } = await admin
    .from('record_shares')
    .select('study_id, dicom_studies(modality, study_description, study_date)')
    .eq('id', shareId)
    .single();

  if (!share || !share.study_id) {
    return NextResponse.json({ ok: false, error: 'Estudio no encontrado.' }, { status: 404 });
  }

  const { data: instances, error } = await admin
    .from('dicom_instances')
    .select('id, series_instance_uid, sop_instance_uid, instance_number')
    .eq('study_id', share.study_id)
    .order('instance_number', { ascending: true });

  if (error || !instances) {
    return NextResponse.json({ ok: false, error: 'No se pudieron cargar las imágenes.' }, { status: 500 });
  }

  const study = Array.isArray(share.dicom_studies) ? share.dicom_studies[0] : share.dicom_studies;

  return NextResponse.json({
    ok: true,
    study: {
      modality: study?.modality ?? null,
      studyDescription: study?.study_description ?? null,
      studyDate: study?.study_date ?? null,
    },
    instances,
  });
}
