import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import SetPasswordForm from '../../components/SetPasswordForm';
import styles from '../login/login.module.css';

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className={styles.page}>
      <div className={styles.center}>
        <SetPasswordForm />
      </div>
      <p className={styles.footnote}>
        Clínica Médica El Rosario · Acceso exclusivo para personal autorizado
      </p>
    </main>
  );
}
