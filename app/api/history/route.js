import { NextResponse } from 'next/server';
import { listSubmissions } from '../../../lib/store';

export async function GET() {
  return NextResponse.json({ ok: true, items: listSubmissions() });
}
