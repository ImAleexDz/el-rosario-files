import { NextResponse } from 'next/server';

// Simulación de autenticación. Sustituir por el proveedor real
// (SSO/OIDC de la clínica o verificación contra la base de usuarios).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { email, password, mfaCode, step } = body;

  if (step === 'mfa') {
    if (mfaCode === '123456') {
      return NextResponse.json({ ok: true, token: 'demo-session-token' });
    }
    return NextResponse.json(
      { ok: false, error: 'Código MFA incorrecto.' },
      { status: 401 }
    );
  }

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Correo y contraseña son requeridos.' },
      { status: 400 }
    );
  }

  // En este flujo de demo, cualquier credencial válida dispara el MFA.
  return NextResponse.json({ ok: true, mfaRequired: true });
}
