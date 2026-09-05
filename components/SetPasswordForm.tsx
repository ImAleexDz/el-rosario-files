'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import styles from './LoginCard.module.css';

export default function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('No se pudo guardar la contraseña. Intenta de nuevo.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.brand}>
        <div>
          <p className={styles.clinicName}>Clínica Médica El Rosario</p>
          <p className={styles.portalName}>Portal clínico</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <h1 className={styles.title}>Crea tu contraseña</h1>
        <p className={styles.subtitle}>
          Es tu primer ingreso. Define una contraseña para tu cuenta institucional.
        </p>

        <label className={styles.label} htmlFor="password">Nueva contraseña</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={styles.input}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className={styles.label} htmlFor="confirmPassword">Confirmar contraseña</label>
        <input
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={styles.input}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.primaryButton} disabled={loading}>
          {loading ? <span className={styles.spinner} aria-hidden="true" /> : 'Guardar y continuar'}
        </button>
      </form>
    </div>
  );
}
