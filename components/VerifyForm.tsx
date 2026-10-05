'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './LoginCard.module.css';

const DicomViewer = dynamic(() => import('./DicomViewer'), {
  ssr: false,
  loading: () => <p className={styles.subtitle}>Cargando visor…</p>,
});

type Result =
  | { kind: 'file'; downloadUrl: string; fileName: string }
  | { kind: 'study'; shareId: string; viewerToken: string };

export default function VerifyForm({ token }: { token: string }) {
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, dateOfBirth }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudo verificar tu identidad.');
        return;
      }
      if (data.kind === 'study') {
        setResult({ kind: 'study', shareId: data.shareId, viewerToken: data.viewerToken });
      } else {
        setResult({ kind: 'file', downloadUrl: data.downloadUrl, fileName: data.fileName });
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card} style={result?.kind === 'study' ? { maxWidth: 680 } : undefined}>
      <div className={styles.brand}>
        <div>
          <p className={styles.clinicName}>Clínica Médica El Rosario</p>
          <p className={styles.portalName}>Portal de pacientes</p>
        </div>
      </div>

      {result?.kind === 'study' && (
        <DicomViewer shareId={result.shareId} viewerToken={result.viewerToken} />
      )}

      {result?.kind === 'file' && (
        <div className={styles.form}>
          <h1 className={styles.title}>Verificación exitosa</h1>
          <p className={styles.subtitle}>
            Tu expediente ({result.fileName}) está listo. Este enlace de descarga es válido por
            unos minutos y de un solo uso.
          </p>
          <a
            href={result.downloadUrl}
            className={styles.primaryButton}
            style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
          >
            Descargar expediente
          </a>
        </div>
      )}

      {!result && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <h1 className={styles.title}>Verifica tu identidad</h1>
          <p className={styles.subtitle}>
            Ingresa tu fecha de nacimiento para acceder a tu expediente médico.
          </p>

          <label className={styles.label} htmlFor="dateOfBirth">Fecha de nacimiento</label>
          <input
            id="dateOfBirth"
            type="date"
            required
            className={styles.input}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? <span className={styles.spinner} aria-hidden="true" /> : 'Ver expediente'}
          </button>
        </form>
      )}
    </div>
  );
}
