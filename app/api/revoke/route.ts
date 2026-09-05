import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const { id } = await request.json().catch(() => ({}));

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta el id del envío.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('record_shares')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq('id', id)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Envío no encontrado.' }, { status: 404 });
  }

  const admin = createAdminClient();
  await admin.from('audit_log').insert({
    actor_type: 'doctor',
    actor_id: user.id,
    action: 'revoke_share',
    entity_type: 'record_shares',
    entity_id: id,
  });

  return NextResponse.json({ ok: true });
}
