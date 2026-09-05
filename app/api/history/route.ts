import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Submission } from '@/lib/types';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('record_shares')
    .select('id, status, created_at, patients(full_name), medical_record_files(file_name)')
    .eq('created_by', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el historial.' }, { status: 500 });
  }

  const items: Submission[] = data.map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    const file = Array.isArray(row.medical_record_files)
      ? row.medical_record_files[0]
      : row.medical_record_files;

    return {
      id: row.id,
      patientName: patient?.full_name ?? 'Paciente',
      fileName: file?.file_name ?? 'expediente.pdf',
      createdAt: new Date(row.created_at).getTime(),
      status: row.status,
    };
  });

  return NextResponse.json({ ok: true, items });
}
