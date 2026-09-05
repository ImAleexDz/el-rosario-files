import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Cliente con service_role: se salta RLS a propósito. Solo para tablas de
// bitácora (audit_log, delivery_log, access_attempts) y el flujo del
// paciente, que no tiene sesión de Supabase Auth. Nunca importar desde
// código que llegue al navegador.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
