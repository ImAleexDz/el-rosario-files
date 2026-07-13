import './globals.css';

export const metadata = {
  title: 'Portal Clínico | Clínica Médica El Rosario',
  description: 'Envío seguro de expedientes clínicos a pacientes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
