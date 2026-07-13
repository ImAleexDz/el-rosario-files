import { NextResponse } from 'next/server';
import { addSubmission } from '../../../lib/store';

// Simula la subida + cifrado del PDF y la generación del enlace seguro
// de un solo uso protegido por el año de nacimiento del paciente.
export async function POST(request) {
  const form = await request.formData();
  const file = form.get('file');
  const phone = form.get('phone');
  const birthYear = form.get('birthYear');

  if (!file) {
    return NextResponse.json(
      { ok: false, error: 'No se recibió ningún archivo.' },
      { status: 400 }
    );
  }
  if (!/^\d{10}$/.test(String(phone || ''))) {
    return NextResponse.json(
      { ok: false, error: 'El celular debe tener 10 dígitos.' },
      { status: 400 }
    );
  }
  const yearNum = Number(birthYear);
  const currentYear = new Date().getFullYear();
  if (
    !/^\d{4}$/.test(String(birthYear || '')) ||
    yearNum < 1900 ||
    yearNum > currentYear
  ) {
    return NextResponse.json(
      { ok: false, error: 'Año de nacimiento inválido.' },
      { status: 400 }
    );
  }

  // Simulación de latencia de cifrado/subida.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const entry = addSubmission({ phone: String(phone), fileName: file.name });

  return NextResponse.json({
    ok: true,
    submission: entry,
    secureLink: `https://portal.clinicaelrosario.mx/e/${entry.id}`,
  });
}
