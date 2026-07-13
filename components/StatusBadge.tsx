import styles from './StatusBadge.module.css';

const CONFIG = {
  downloaded: { label: 'Descargado', className: 'downloaded' },
  pending: { label: 'Pendiente', className: 'pending' },
  expired: { label: 'Expirado', className: 'expired' },
};

export default function StatusBadge({ status }) {
  const config = CONFIG[status] || CONFIG.pending;
  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {config.label}
    </span>
  );
}
