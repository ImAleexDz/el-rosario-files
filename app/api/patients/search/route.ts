import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Solo letras/números/espacios/acentos: evita que el texto de búsqueda
// rompa la sintaxis de filtros de PostgREST (.or, .ilike).
function sanitizeQuery(raw: string) {
  return raw.replace(/[^\p{L}\p{N}\s+]/gu, '').trim();
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = sanitizeQuery(searchParams.get('q') || '');

  if (q.length < 2) {
    return NextResponse.json({ ok: true, patients: [] });
  }

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, date_of_birth, email, phone')
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8);

  if (error) {
    return NextResponse.json({ ok: false, error: 'No se pudo buscar pacientes.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, patients: data });
}
