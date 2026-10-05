import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveViewerSession } from '@/lib/viewerSessions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string; instanceId: string }> }
) {
  const { shareId, instanceId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';

  if (!token || !(await resolveViewerSession(shareId, token))) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: share } = await admin.from('record_shares').select('study_id').eq('id', shareId).single();
  if (!share?.study_id) {
    return NextResponse.json({ ok: false, error: 'Estudio no encontrado.' }, { status: 404 });
  }

  const { data: instance } = await admin
    .from('dicom_instances')
    .select('storage_bucket, storage_path')
    .eq('id', instanceId)
    .eq('study_id', share.study_id)
    .single();

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'Imagen no encontrada.' }, { status: 404 });
  }

  const { data: blob, error } = await admin.storage
    .from(instance.storage_bucket)
    .download(instance.storage_path);

  if (error || !blob) {
    return NextResponse.json({ ok: false, error: 'No se pudo leer la imagen.' }, { status: 500 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/dicom',
      'Cache-Control': 'private, max-age=1800',
    },
  });
}
