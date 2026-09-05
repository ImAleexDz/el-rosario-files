import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './server';

// Verifica sesión + estado del médico. Se usa cerca del origen de datos
// (páginas/route handlers), no solo en proxy.ts, siguiendo la guía de Next
// de no depender únicamente del check optimista en Proxy.
export async function getCurrentDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, full_name, email, role, is_active, mfa_enabled')
    .eq('id', user.id)
    .single();

  if (!doctor || !doctor.is_active) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  return doctor;
}
