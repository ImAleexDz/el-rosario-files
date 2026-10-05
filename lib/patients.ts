import 'server-only';
import type { createClient } from './supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PatientInput = {
  mode: 'existing' | 'new';
  patientId?: string;
  emailOverride?: string;
  fullName?: string;
  dateOfBirth?: string;
  email?: string;
};

export type PatientResolution =
  | { ok: true; patientId: string; patientEmail: string }
  | { ok: false; error: string; status: number };

function isValidDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1900 && date.getTime() <= Date.now();
}

// Compartido entre el flujo de PDF y el de DICOM: busca/crea al paciente y
// resuelve su correo (pidiéndolo si falta), para poder generar el enlace.
export async function resolvePatient(
  supabase: SupabaseServerClient,
  input: PatientInput
): Promise<PatientResolution> {
  if (input.mode === 'existing') {
    const patientId = input.patientId || '';
    if (!patientId) {
      return { ok: false, error: 'Falta el paciente seleccionado.', status: 400 };
    }

    const emailOverride = (input.emailOverride || '').trim();

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, email')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return { ok: false, error: 'Paciente no encontrado.', status: 404 };
    }

    let patientEmail: string | null = patient.email;

    if (!patientEmail && emailOverride) {
      if (!EMAIL_RE.test(emailOverride)) {
        return { ok: false, error: 'Correo del paciente inválido.', status: 400 };
      }
      const { error: updateError } = await supabase
        .from('patients')
        .update({ email: emailOverride })
        .eq('id', patientId);
      if (updateError) {
        return { ok: false, error: 'No se pudo guardar el correo del paciente.', status: 500 };
      }
      patientEmail = emailOverride;
    }

    if (!patientEmail) {
      return {
        ok: false,
        error: 'El paciente no tiene correo registrado para el envío.',
        status: 400,
      };
    }

    return { ok: true, patientId, patientEmail };
  }

  const fullName = (input.fullName || '').trim();
  const dateOfBirth = (input.dateOfBirth || '').trim();
  const email = (input.email || '').trim();

  if (!fullName || fullName.length < 3) {
    return { ok: false, error: 'Nombre del paciente inválido.', status: 400 };
  }
  if (!isValidDateOfBirth(dateOfBirth)) {
    return { ok: false, error: 'Fecha de nacimiento inválida.', status: 400 };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Correo del paciente inválido.', status: 400 };
  }

  const { data: newPatient, error: insertError } = await supabase
    .from('patients')
    .insert({ full_name: fullName, date_of_birth: dateOfBirth, email })
    .select('id, email')
    .single();

  if (insertError || !newPatient || !newPatient.email) {
    return { ok: false, error: 'No se pudo registrar al paciente.', status: 500 };
  }

  return { ok: true, patientId: newPatient.id, patientEmail: newPatient.email };
}
