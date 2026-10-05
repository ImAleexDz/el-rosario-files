'use client';

import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import * as dicomParser from 'dicom-parser';
import { createClient } from '../lib/supabase/client';
import { usePatientPicker } from './usePatientPicker';
import styles from './UploadHero.module.css';

type DicomUploadHeroProps = {
  onUploaded?: () => void;
};

type ParsedInstance = {
  file: File;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  instanceNumber: number | null;
  modality: string | null;
  studyDescription: string | null;
  studyDate: string | null;
};

const MAX_FILES = 1000;
const UPLOAD_CONCURRENCY = 4;

async function parseDicomFile(file: File): Promise<ParsedInstance | null> {
  try {
    const buffer = await file.arrayBuffer();
    const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
    const studyInstanceUid = dataSet.string('x0020000d');
    const sopInstanceUid = dataSet.string('x00080018');
    if (!studyInstanceUid || !sopInstanceUid) return null;
    return {
      file,
      studyInstanceUid,
      seriesInstanceUid: dataSet.string('x0020000e') || 'serie-1',
      sopInstanceUid,
      instanceNumber: dataSet.intString('x00200013') ?? null,
      modality: dataSet.string('x00080060') || null,
      studyDescription: dataSet.string('x00081030') || null,
      studyDate: dataSet.string('x00080020') || null,
    };
  } catch {
    return null;
  }
}

async function uploadWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number
) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export default function DicomUploadHero({ onUploaded }: DicomUploadHeroProps) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [instances, setInstances] = useState<ParsedInstance[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [secureLink, setSecureLink] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const patient = usePatientPicker();

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMsg('');
    setInstances([]);
    setProgress({ done: 0, total: 0 });
    setSecureLink('');
    patient.reset();
  }, [patient]);

  async function handleBrowse(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;
    if (picked.length > MAX_FILES) {
      setErrorMsg(`Selecciona como máximo ${MAX_FILES} archivos.`);
      return;
    }

    setStatus('parsing');
    setErrorMsg('');

    const parsed = (await Promise.all(picked.map(parseDicomFile))).filter(
      (p): p is ParsedInstance => p !== null
    );

    if (parsed.length === 0) {
      setStatus('idle');
      setErrorMsg('No se encontraron archivos DICOM válidos en la selección.');
      return;
    }

    const uids = new Set(parsed.map((p) => p.studyInstanceUid));
    if (uids.size > 1) {
      setStatus('idle');
      setErrorMsg('Los archivos pertenecen a más de un estudio. Selecciona uno solo a la vez.');
      return;
    }

    setInstances(parsed);
    setStatus('ready');
  }

  const canSubmit = instances.length > 0 && status === 'ready' && patient.valid;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('uploading');
    setErrorMsg('');
    setProgress({ done: 0, total: instances.length });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus('error');
        setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.');
        return;
      }

      const studyId = crypto.randomUUID();
      const withPaths = instances.map((instance) => ({
        instance,
        path: `${user.id}/${studyId}/${instance.sopInstanceUid}.dcm`,
      }));

      const urlsRes = await fetch('/api/dicom/upload-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: withPaths.map((w) => w.path) }),
      });
      const urlsData = await urlsRes.json();
      if (!urlsRes.ok || !urlsData.ok) {
        setStatus('error');
        setErrorMsg(urlsData.error || 'No se pudieron preparar las subidas.');
        return;
      }

      const tokenByPath = new Map<string, string>(
        urlsData.uploads.map((u: { path: string; token: string }) => [u.path, u.token])
      );

      let uploadFailed = false;
      await uploadWithConcurrency(
        withPaths,
        async ({ instance, path }) => {
          if (uploadFailed) return;
          const token = tokenByPath.get(path);
          if (!token) {
            uploadFailed = true;
            return;
          }
          const { error } = await supabase.storage
            .from('estudios-dicom')
            .uploadToSignedUrl(path, token, instance.file, { contentType: 'application/dicom' });
          if (error) {
            uploadFailed = true;
            return;
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        },
        UPLOAD_CONCURRENCY
      );

      if (uploadFailed) {
        setStatus('error');
        setErrorMsg('Falló la subida de una o más imágenes. Intenta de nuevo.');
        return;
      }

      const first = instances[0];
      const commitRes = await fetch('/api/dicom/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyId,
          studyInstanceUid: first.studyInstanceUid,
          modality: first.modality,
          studyDescription: first.studyDescription,
          studyDate: first.studyDate,
          instances: withPaths.map(({ instance, path }) => ({
            seriesInstanceUid: instance.seriesInstanceUid,
            sopInstanceUid: instance.sopInstanceUid,
            instanceNumber: instance.instanceNumber,
            storagePath: path,
            fileSizeBytes: instance.file.size,
          })),
          patient: patient.toJSON(),
        }),
      });
      const commitData = await commitRes.json();

      if (!commitRes.ok || !commitData.ok) {
        setStatus('error');
        setErrorMsg(commitData.error || 'No se pudo registrar el estudio.');
        return;
      }

      setStatus('success');
      setSecureLink(commitData.secureLink);
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

  const first = instances[0];

  return (
    <div className={styles.card}>
      <h1 className={styles.heading}>Enviar estudio DICOM al paciente</h1>
      <p className={styles.subheading}>
        El paciente deberá confirmar su fecha de nacimiento para ver el estudio en el visor.
      </p>

      {status === 'success' ? (
        <div className={styles.successPanel}>
          <div className={styles.successIcon} aria-hidden="true">✓</div>
          <p className={styles.successTitle}>Enlace generado</p>
          <p className={styles.successSubtitle}>
            El paciente deberá confirmar su fecha de nacimiento para ver el estudio.
          </p>
          <div className={styles.linkRow}>
            <code className={styles.linkText}>{secureLink}</code>
            <button type="button" className={styles.copyButton} onClick={copyLink}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button type="button" className={styles.primaryButton} onClick={reset}>
            Enviar otro estudio
          </button>
        </div>
      ) : (
        <>
          <div
            className={`${styles.dropzone} ${instances.length ? styles.dropzoneHasFile : ''}`}
            onClick={() => instances.length === 0 && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (instances.length === 0 && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
            }}
            aria-label="Seleccionar uno o más archivos DICOM"
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className={styles.hiddenInput}
              onChange={handleBrowse}
              tabIndex={-1}
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error -- webkitdirectory no está tipado en HTMLInputElement
              webkitdirectory=""
              multiple
              className={styles.hiddenInput}
              onChange={handleBrowse}
              tabIndex={-1}
            />

            {status === 'parsing' ? (
              <p className={styles.dropText}>Leyendo archivos DICOM…</p>
            ) : instances.length === 0 ? (
              <>
                <div className={styles.dropIcon} aria-hidden="true">⬆</div>
                <p className={styles.dropText}>Haz clic para seleccionar uno o más archivos .dcm</p>
                <p className={styles.dropHint}>De un solo estudio</p>
                <button
                  type="button"
                  className={styles.copyButton}
                  style={{ marginTop: 10 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                >
                  O selecciona una carpeta completa
                </button>
              </>
            ) : (
              <div className={styles.filePill} onClick={(e) => e.stopPropagation()}>
                <span className={styles.fileIcon} aria-hidden="true">🩻</span>
                <div className={styles.fileMeta}>
                  <span className={styles.fileName}>
                    {first?.studyDescription || 'Estudio DICOM'} {first?.modality ? `· ${first.modality}` : ''}
                  </span>
                  <span className={styles.fileSize}>{instances.length} imágenes</span>
                </div>
                {status !== 'uploading' && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    aria-label="Quitar estudio"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {errorMsg && status !== 'uploading' && <p className={styles.rejectionText}>{errorMsg}</p>}

          {instances.length > 0 && (
            <form onSubmit={handleSubmit} className={styles.form}>
              {patient.picker}

              {status === 'error' && <p className={styles.formError}>{errorMsg}</p>}

              {status === 'uploading' ? (
                <div className={styles.progressWrap}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} />
                  </div>
                  <span className={styles.progressLabel}>
                    Subiendo imágenes… {progress.done}/{progress.total}
                  </span>
                </div>
              ) : (
                <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
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
