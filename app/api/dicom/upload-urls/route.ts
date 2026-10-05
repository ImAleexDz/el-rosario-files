import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_BATCH = 500;

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
  const paths: unknown = body.paths;

  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_BATCH) {
    return NextResponse.json({ ok: false, error: 'Número de archivos inválido.' }, { status: 400 });
  }
  if (!paths.every((p): p is string => typeof p === 'string' && p.startsWith(`${user.id}/`))) {
    return NextResponse.json({ ok: false, error: 'Ruta de archivo inválida.' }, { status: 400 });
  }

  const uploads = await Promise.all(
    paths.map(async (path: string) => {
      const { data, error } = await supabase.storage.from('estudios-dicom').createSignedUploadUrl(path);
      if (error || !data) return { path, ok: false as const };
      return { path, ok: true as const, token: data.token, signedUrl: data.signedUrl };
    })
  );

  if (uploads.some((u) => !u.ok)) {
    return NextResponse.json(
      { ok: false, error: 'No se pudieron generar las URLs de subida.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, uploads });
}
