'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClinicLogo from './ClinicLogo';
import styles from './Header.module.css';

function initialsOf(name: string): string {
  return name
    .replace(/^Dra?\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function Header({ doctorName = 'Dr(a).' }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <ClinicLogo size={150} />
        {/* <span className={styles.clinicName}>Clínica Médica El Rosario</span> */}
      </div>

      <div className={styles.profile} ref={menuRef}>
        <button
          type="button"
          className={styles.profileButton}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className={styles.avatar} aria-hidden="true">
            {initialsOf(doctorName)}
          </span>
          <span className={styles.doctorName}>{doctorName}</span>
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>

        {open && (
          <div className={styles.menu} role="menu">
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={handleLogout}
              disabled={signingOut}
            >
              {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
