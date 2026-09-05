import VerifyForm from '../../../components/VerifyForm';
import styles from '../../login/login.module.css';

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className={styles.page}>
      <div className={styles.center}>
        <VerifyForm token={token} />
      </div>
      <p className={styles.footnote}>
        Clínica Médica El Rosario · Acceso exclusivo al titular del expediente
      </p>
    </main>
  );
}
