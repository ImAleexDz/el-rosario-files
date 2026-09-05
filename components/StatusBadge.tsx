import styles from './StatusBadge.module.css';
import type { SubmissionStatus } from '../lib/types';

const CONFIG: Record<SubmissionStatus, { label: string; className: string }> = {
  downloaded: { label: 'Descargado', className: 'downloaded' },
  pending: { label: 'Pendiente', className: 'pending' },
  expired: { label: 'Expirado', className: 'expired' },
};

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  const config = CONFIG[status] || CONFIG.pending;
  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {config.label}
    </span>
  );
}
