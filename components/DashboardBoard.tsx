'use client';

import { useCallback, useState } from 'react';
import UploadHero from './UploadHero';
import HistoryTable from './HistoryTable';
import styles from './DashboardBoard.module.css';

export default function DashboardBoard({ gridClassName }) {
  const [refreshTick, setRefreshTick] = useState(0);

  const handleUploaded = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return (
    <div className={gridClassName}>
      <section className={styles.primaryColumn} aria-label="Enviar expediente">
        <UploadHero onUploaded={handleUploaded} />
      </section>
      <section className={styles.secondaryColumn} aria-label="Historial de envíos">
        <HistoryTable refreshTick={refreshTick} />
      </section>
    </div>
  );
}
