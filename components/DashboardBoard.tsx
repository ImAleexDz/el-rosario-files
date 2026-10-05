'use client';

import { useCallback, useState } from 'react';
import UploadHero from './UploadHero';
import DicomUploadHero from './DicomUploadHero';
import HistoryTable from './HistoryTable';
import styles from './DashboardBoard.module.css';

export default function DashboardBoard({ gridClassName }: { gridClassName: string }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [uploadType, setUploadType] = useState<'pdf' | 'dicom'>('pdf');

  const handleUploaded = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return (
    <div className={gridClassName}>
      <section className={styles.primaryColumn} aria-label="Enviar expediente">
        <div className={styles.tabRow} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={uploadType === 'pdf'}
            className={`${styles.tab} ${uploadType === 'pdf' ? styles.tabActive : ''}`}
            onClick={() => setUploadType('pdf')}
          >
            Documento (PDF)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={uploadType === 'dicom'}
            className={`${styles.tab} ${uploadType === 'dicom' ? styles.tabActive : ''}`}
            onClick={() => setUploadType('dicom')}
          >
            Estudio DICOM
          </button>
        </div>

        {uploadType === 'pdf' ? (
          <UploadHero onUploaded={handleUploaded} />
        ) : (
          <DicomUploadHero onUploaded={handleUploaded} />
        )}
      </section>
      <section className={styles.secondaryColumn} aria-label="Historial de envíos">
        <HistoryTable refreshTick={refreshTick} />
      </section>
    </div>
  );
}
