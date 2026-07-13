import LoginCard from '../../components/LoginCard';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.center}>
        <LoginCard />
      </div>
      <p className={styles.footnote}>
        Clínica Médica El Rosario · Acceso exclusivo para personal autorizado
      </p>
    </main>
  );
}
