'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ClinicLogo from './ClinicLogo';
import styles from './LoginCard.module.css';

const STEPS = {
  START: 'start',
  CREDENTIALS: 'credentials',
  MFA: 'mfa',
};

export default function LoginCard() {
  const router = useRouter();
  const [step, setStep] = useState(STEPS.START);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [loadingSSO, setLoadingSSO] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSSO() {
    setError('');
    setLoadingSSO(true);
    // Simula el redireccionamiento/roundtrip del proveedor SSO de la clínica.
    await new Promise((r) => setTimeout(r, 900));
    router.push('/dashboard');
  }

  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      if (data.mfaRequired) {
        setStep(STEPS.MFA);
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'mfa', mfaCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Código incorrecto.');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.brand}>
        {/* <ClinicLogo size={40} /> */}
        <div>
          <p className={styles.clinicName}>Clínica Médica El Rosario</p>
          <p className={styles.portalName}>Portal clínico</p>
        </div>
      </div>

      {step === STEPS.START && (
        <>
          <h1 className={styles.title}>Bienvenido, doctor(a)</h1>
          <p className={styles.subtitle}>
            Ingresa con tu cuenta institucional para continuar.
          </p>

          <button
            type="button"
            className={styles.ssoButton}
            onClick={handleSSO}
            disabled={loadingSSO}
          >
            {loadingSSO ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <span className={styles.ssoIcon} aria-hidden="true">🔒</span>
            )}
            {loadingSSO ? 'Conectando…' : 'Iniciar sesión con cuenta de la clínica'}
          </button>

          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setStep(STEPS.CREDENTIALS)}
          >
            Usar correo y contraseña institucional
          </button>
        </>
      )}

      {step === STEPS.CREDENTIALS && (
        <form onSubmit={handleCredentialsSubmit} className={styles.form}>
          <h1 className={styles.title}>Acceso con correo</h1>
          <p className={styles.subtitle}>
            Usa tu correo institucional de la clínica.
          </p>

          <label className={styles.label} htmlFor="email">Correo institucional</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            className={styles.input}
            placeholder="dr.nombre@clinicaelrosario.mx"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className={styles.label} htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className={styles.input}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? <span className={styles.spinner} aria-hidden="true" /> : 'Continuar'}
          </button>

          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setStep(STEPS.START);
              setError('');
            }}
          >
            Volver a la cuenta de la clínica
          </button>
        </form>
      )}

      {step === STEPS.MFA && (
        <form onSubmit={handleMfaSubmit} className={styles.form}>
          <h1 className={styles.title}>Verificación en dos pasos</h1>
          <p className={styles.subtitle}>
            Ingresa el código de 6 dígitos enviado a tu dispositivo autenticador.
          </p>

          <label className={styles.label} htmlFor="mfa">Código de verificación</label>
          <input
            id="mfa"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            className={`${styles.input} ${styles.mfaInput}`}
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? <span className={styles.spinner} aria-hidden="true" /> : 'Verificar e ingresar'}
          </button>

          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setStep(STEPS.CREDENTIALS);
              setError('');
              setMfaCode('');
            }}
          >
            Volver
          </button>
        </form>
      )}
    </div>
  );
}
