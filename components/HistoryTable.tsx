'use client';

import { useEffect, useState } from 'react';
import StatusBadge from './StatusBadge';
import styles from './HistoryTable.module.css';

function formatPhone(phone) {
  if (!phone || phone.length !== 10) return phone;
  return `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
}

function relativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours} h`;
}

export default function HistoryTable({ refreshTick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);

  async function loadHistory() {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [refreshTick]);

  async function handleRevoke(id) {
    setRevokingId(id);
    try {
      const res = await fetch('/api/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: 'expired' } : it))
        );
      }
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Envíos recientes</h2>
        <span className={styles.subtitle}>Últimas 24 h</span>
      </div>

      {loading ? (
        <p className={styles.empty}>Cargando historial…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Aún no hay envíos en las últimas 24 horas.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Celular</th>
                <th>Hora</th>
                <th>Estado</th>
                <th aria-label="Acción" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.mono}>{formatPhone(item.phone)}</td>
                  <td className={styles.timeCell}>{relativeTime(item.createdAt)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className={styles.actionCell}>
                    <button
                      type="button"
                      className={styles.revokeButton}
                      onClick={() => handleRevoke(item.id)}
                      disabled={item.status === 'expired' || revokingId === item.id}
                      title="Revocar enlace"
                      aria-label={`Revocar enlace de ${formatPhone(item.phone)}`}
                    >
                      {revokingId === item.id ? '…' : '🗑'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.footNote}>
        Se muestran los últimos {items.length} movimientos. Los archivos ya
        descargados o expirados se eliminan del servidor.
      </p>
    </div>
  );
}
