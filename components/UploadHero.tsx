'use client';

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent, type FormEvent } from 'react';
import { usePatientPicker } from './usePatientPicker';
import styles from './UploadHero.module.css';

type UploadHeroProps = {
  onUploaded?: () => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadHero({ onUploaded }: UploadHeroProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragState, setDragState] = useState('idle'); // idle | over | rejected
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [secureLink, setSecureLink] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  const patient = usePatientPicker();

  const acceptFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.type !== 'application/pdf') {
      setDragState('rejected');
      setErrorMsg('Solo se aceptan archivos PDF.');
      setTimeout(() => setDragState('idle'), 1200);
      return;
    }
    setErrorMsg('');
    setFile(candidate);
    setStatus('idle');
    setSecureLink('');
  }, []);

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounter.current += 1;
    setDragState('over');
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragState('idle');
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragState('idle');
    const dropped = e.dataTransfer.files?.[0];
    acceptFile(dropped);
  }

  function handleBrowse(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    acceptFile(picked);
    e.target.value = '';
  }

  function removeFile(e?: { stopPropagation?: () => void }) {
    e?.stopPropagation?.();
    setFile(null);
    setStatus('idle');
    setErrorMsg('');
    setSecureLink('');
    patient.reset();
  }

  const canSubmit = !!file && status !== 'uploading' && patient.valid;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !file) return;
    setStatus('uploading');
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      patient.appendToFormData(formData);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'No se pudo generar el enlace. Intenta de nuevo.');
        return;
      }

      setStatus('success');
      setSecureLink(data.secureLink);
      onUploaded?.();
    } catch {
      setStatus('error');
      setErrorMsg('Error de conexión. Intenta de nuevo.');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(secureLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard no disponible; el link sigue visible para copiar manualmente */
    }
  }

  function sendAnother() {
    removeFile();
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.heading}>Enviar expediente al paciente</h1>
      <p className={styles.subheading}>
        El paciente deberá confirmar su fecha de nacimiento para abrir el expediente.
      </p>

      {status === 'success' ? (
        <div className={styles.successPanel}>
          <div className={styles.successIcon} aria-hidden="true">✓</div>
          <p className={styles.successTitle}>Enlace generado</p>
          <p className={styles.successSubtitle}>
            El paciente deberá confirmar su fecha de nacimiento para abrir el expediente.
          </p>
          <div className={styles.linkRow}>
            <code className={styles.linkText}>{secureLink}</code>
            <button type="button" className={styles.copyButton} onClick={copyLink}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button type="button" className={styles.primaryButton} onClick={sendAnother}>
            Enviar otro expediente
          </button>
        </div>
      ) : (
        <>
          <div
            className={`${styles.dropzone} ${
              dragState === 'over' ? styles.dropzoneOver : ''
            } ${dragState === 'rejected' ? styles.dropzoneRejected : ''} ${
              file ? styles.dropzoneHasFile : ''
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (!file && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
            }}
            aria-label="Zona para arrastrar o seleccionar el expediente en PDF"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className={styles.hiddenInput}
              onChange={handleBrowse}
              tabIndex={-1}
            />

            {status === 'uploading' && (
              <div className={styles.scanLine} aria-hidden="true" />
            )}

            {!file ? (
              <>
                <div className={styles.dropIcon} aria-hidden="true">⬆</div>
                <p className={styles.dropText}>
                  Arrastra el expediente en PDF aquí o haz clic para buscar
                </p>
                <p className={styles.dropHint}>Solo PDF · Máximo 20 MB</p>
              </>
            ) : (
              <div className={styles.filePill} onClick={(e) => e.stopPropagation()}>
                <span className={styles.fileIcon} aria-hidden="true">📄</span>
                <div className={styles.fileMeta}>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>{formatBytes(file.size)}</span>
                </div>
                {status !== 'uploading' && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={removeFile}
                    aria-label="Quitar archivo"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {dragState === 'rejected' && (
            <p className={styles.rejectionText}>{errorMsg}</p>
          )}

          {file && (
            <form onSubmit={handleSubmit} className={styles.form}>
              {patient.picker}

              {status === 'error' && <p className={styles.formError}>{errorMsg}</p>}

              {status === 'uploading' ? (
                <div className={styles.progressWrap}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} />
                  </div>
                  <span className={styles.progressLabel}>Subiendo expediente…</span>
                </div>
              ) : (
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={!canSubmit}
                >
                  Generar enlace seguro
                </button>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}
