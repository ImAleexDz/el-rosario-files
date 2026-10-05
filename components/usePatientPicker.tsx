'use client';

import { useEffect, useState } from 'react';
import styles from './UploadHero.module.css';

type Patient = {
  id: string;
  full_name: string;
  date_of_birth: string;
  email: string | null;
  phone: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Selector de paciente (buscar existente o dar de alta uno nuevo), compartido
// entre el envío de PDF y el de estudios DICOM para no duplicar esta UI.
export function usePatientPicker() {
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

  function reset() {
    setPatientMode('search');
    setQuery('');
    setResults([]);
    setSelectedPatient(null);
    setEmailOverride('');
    setNewFullName('');
    setNewDateOfBirth('');
    setNewEmail('');
  }

  const newPatientValid =
    newFullName.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(newDateOfBirth) && EMAIL_RE.test(newEmail);

  const existingPatientValid =
    !!selectedPatient && (!!selectedPatient.email || EMAIL_RE.test(emailOverride));

  const valid = patientMode === 'new' ? newPatientValid : existingPatientValid;

  function appendToFormData(formData: FormData) {
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
  }

  function toJSON() {
    if (patientMode === 'new') {
      return {
        mode: 'new' as const,
        fullName: newFullName.trim(),
        dateOfBirth: newDateOfBirth,
        email: newEmail.trim(),
      };
    }
    return {
      mode: 'existing' as const,
      patientId: selectedPatient?.id,
      emailOverride: selectedPatient?.email ? undefined : emailOverride.trim(),
    };
  }

  const picker = (
    <div className={styles.field}>
      <label className={styles.label}>Paciente</label>

      {patientMode === 'search' ? (
        <>
          {selectedPatient ? (
            <div className={styles.filePill}>
              <div className={styles.fileMeta}>
                <span className={styles.fileName}>{selectedPatient.full_name}</span>
                <span className={styles.fileSize}>Nacimiento: {selectedPatient.date_of_birth}</span>
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
  );

  return { picker, valid, appendToFormData, toJSON, reset };
}
