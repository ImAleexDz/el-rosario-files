'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent, type FormEvent } from 'react';
import styles from './UploadHero.module.css';

type UploadHeroProps = {
  onUploaded?: () => void;
};

type Patient = {
  id: string;
  full_name: string;
  date_of_birth: string;
  email: string | null;
  phone: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const [patientMode, setPatientMode] = useState<'search' | 'new'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [emailOverride, setEmailOverride] = useState('');

  const [newFullName, setNewFullName] = useState('');
  const [newDateOfBirth, setNewDateOfBirth] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (patientMode !== 'search' || selectedPatient || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.ok ? data.patients : []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, patientMode, selectedPatient]);

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

  function resetPatientFields() {
    setPatientMode('search');
    setQuery('');
    setResults([]);
    setSelectedPatient(null);
    setEmailOverride('');
    setNewFullName('');
    setNewDateOfBirth('');
    setNewEmail('');
  }

  function removeFile(e?: { stopPropagation?: () => void }) {
    e?.stopPropagation?.();
    setFile(null);
    setStatus('idle');
    setErrorMsg('');
    setSecureLink('');
    resetPatientFields();
  }

  const newPatientValid =
    newFullName.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(newDateOfBirth) && EMAIL_RE.test(newEmail);

  const existingPatientValid =
    !!selectedPatient && (!!selectedPatient.email || EMAIL_RE.test(emailOverride));

  const canSubmit =
    !!file &&
    status !== 'uploading' &&
    (patientMode === 'new' ? newPatientValid : existingPatientValid);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !file) return;
    setStatus('uploading');
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      if (patientMode === 'new') {
        formData.append('mode', 'new');
        formData.append('fullName', newFullName.trim());
        formData.append('dateOfBirth', newDateOfBirth);
        formData.append('email', newEmail.trim());
      } else if (selectedPatient) {
        formData.append('mode', 'existing');
        formData.append('patientId', selectedPatient.id);
        if (!selectedPatient.email) {
          formData.append('emailOverride', emailOverride.trim());
        }
      }

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
              <div className={styles.field}>
                <label className={styles.label}>Paciente</label>

                {patientMode === 'search' ? (
                  <>
                    {selectedPatient ? (
                      <div className={styles.filePill}>
                        <div className={styles.fileMeta}>
                          <span className={styles.fileName}>{selectedPatient.full_name}</span>
                          <span className={styles.fileSize}>
                            Nacimiento: {selectedPatient.date_of_birth}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => {
                            setSelectedPatient(null);
                            setEmailOverride('');
                          }}
                          aria-label="Cambiar paciente"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          className={styles.input}
                          placeholder="Buscar por nombre o teléfono…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {searching && <span className={styles.progressLabel}>Buscando…</span>}
                        {results.length > 0 && (
                          <div className={styles.patientResults}>
                            {results.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={styles.patientResultItem}
                                onClick={() => {
                                  setSelectedPatient(p);
                                  setResults([]);
                                }}
                              >
                                <span className={styles.fileName}>{p.full_name}</span>
                                <span className={styles.fileSize}>{p.date_of_birth}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {selectedPatient && !selectedPatient.email && (
                      <div style={{ marginTop: 10 }}>
                        <label className={styles.label} htmlFor="emailOverride">
                          Este paciente no tiene correo registrado
                        </label>
                        <input
                          id="emailOverride"
                          type="email"
                          className={styles.input}
                          placeholder="correo@paciente.com"
                          value={emailOverride}
                          onChange={(e) => setEmailOverride(e.target.value)}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className={styles.copyButton}
                      style={{ marginTop: 10, alignSelf: 'flex-start' }}
                      onClick={() => {
                        setPatientMode('new');
                        setSelectedPatient(null);
                        setResults([]);
                      }}
                    >
                      No aparece, crear paciente nuevo
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="newFullName">Nombre completo</label>
                        <input
                          id="newFullName"
                          className={styles.input}
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="newDateOfBirth">Fecha de nacimiento</label>
                        <input
                          id="newDateOfBirth"
                          type="date"
                          className={styles.input}
                          value={newDateOfBirth}
                          onChange={(e) => setNewDateOfBirth(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className={styles.field} style={{ marginTop: 14 }}>
                      <label className={styles.label} htmlFor="newEmail">Correo del paciente</label>
                      <input
                        id="newEmail"
                        type="email"
                        className={styles.input}
                        placeholder="correo@paciente.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.copyButton}
                      style={{ marginTop: 10, alignSelf: 'flex-start' }}
                      onClick={() => setPatientMode('search')}
                    >
                      Buscar paciente existente
                    </button>
                  </>
                )}
              </div>

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
