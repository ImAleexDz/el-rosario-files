import { NextResponse } from 'next/server';

export async function POST() {
  // Aquí se invalidaría la sesión / cookie real.
  return NextResponse.json({ ok: true });
}
