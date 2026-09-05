import Header from '../../components/Header';
import DashboardBoard from '../../components/DashboardBoard';
import { getCurrentDoctor } from '../../lib/supabase/dal';
import styles from './dashboard.module.css';

export const metadata = {
  title: 'Espacio de trabajo | Clínica Médica El Rosario',
};

export default async function DashboardPage() {
  const doctor = await getCurrentDoctor();

  return (
    <div className={styles.shell}>
      <Header doctorName={doctor.full_name} />
      <main className={styles.main}>
        <DashboardBoard gridClassName={styles.grid} />
      </main>
    </div>
  );
}
