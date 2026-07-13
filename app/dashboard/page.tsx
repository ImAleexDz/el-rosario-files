import Header from '../../components/Header';
import DashboardBoard from '../../components/DashboardBoard';
import styles from './dashboard.module.css';

export const metadata = {
  title: 'Espacio de trabajo | Clínica Médica El Rosario',
};

export default function DashboardPage() {
  return (
    <div className={styles.shell}>
      <Header doctorName="Dra. Renata Ibarra" />
      <main className={styles.main}>
        <DashboardBoard gridClassName={styles.grid} />
      </main>
    </div>
  );
}
