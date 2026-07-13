// Almacén en memoria para la demo. En producción esto vive en una base de
// datos real (p. ej. Postgres) con expiración automática de archivos (TTL).

const now = () => Date.now();

// Semilla de datos para que el historial no se vea vacío en la demo.
let submissions = [
  {
    id: 'snd_1001',
    phone: '5512345678',
    fileName: 'estudios_laboratorio.pdf',
    createdAt: now() - 1000 * 60 * 42,
    status: 'downloaded', // downloaded | pending | expired
  },
  {
    id: 'snd_1002',
    phone: '5598765432',
    fileName: 'radiografia_torax.pdf',
    createdAt: now() - 1000 * 60 * 60 * 3,
    status: 'pending',
  },
  {
    id: 'snd_1003',
    phone: '5533221100',
    fileName: 'resultados_covid.pdf',
    createdAt: now() - 1000 * 60 * 60 * 20,
    status: 'expired',
  },
];

export function listSubmissions() {
  const cutoff = now() - 1000 * 60 * 60 * 24; // últimas 24h
  return submissions
    .filter((s) => s.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 15);
}

export function addSubmission({ phone, fileName }) {
  const entry = {
    id: `snd_${Math.random().toString(36).slice(2, 9)}`,
    phone,
    fileName,
    createdAt: now(),
    status: 'pending',
  };
  submissions = [entry, ...submissions];
  return entry;
}

export function revokeSubmission(id) {
  const item = submissions.find((s) => s.id === id);
  if (!item) return null;
  item.status = 'expired';
  return item;
}
