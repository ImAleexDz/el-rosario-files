import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();

  if (body.step === 'mfa') {
    const { mfaCode } = body;

    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData?.totp.find((f) => f.status === 'verified');

    if (factorsError || !totpFactor) {
      return NextResponse.json(
        { ok: false, error: 'No se encontró un método de verificación configurado.' },
        { status: 400 }
      );
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });

    if (challengeError) {
      return NextResponse.json(
        { ok: false, error: 'No se pudo iniciar la verificación.' },
        { status: 400 }
      );
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: mfaCode,
    });

    if (verifyError) {
      return NextResponse.json({ ok: false, error: 'Código incorrecto.' }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'Correo y contraseña son requeridos.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    console.error('[login] signInWithPassword error:', error);
    return NextResponse.json(
      { ok: false, error: 'Correo o contraseña incorrectos.' },
      { status: 401 }
    );
  }

  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('is_active')
    .eq('id', data.user.id)
    .single();

  if (!doctor || !doctor.is_active) {
    console.error('[login] doctors lookup failed for', data.user.id, doctorError);
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: 'Esta cuenta no está autorizada para acceder.' },
      { status: 403 }
    );
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = Boolean(aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel);

  return NextResponse.json({ ok: true, mfaRequired });
}
