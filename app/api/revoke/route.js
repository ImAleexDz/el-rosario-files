import { NextResponse } from 'next/server';
import { revokeSubmission } from '../../../lib/store';

export async function POST(request) {
  const { id } = await request.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Falta el id del envío.' },
      { status: 400 }
    );
  }
  const item = revokeSubmission(id);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: 'Envío no encontrado.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, submission: item });
}
