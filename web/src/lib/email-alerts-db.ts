// Alerte pe email — acces la baza de date (doar pe server).
//
// Alertele de pret s-au inchis pe 20 nov. 2026: site-ul nu mai creeaza, confirma sau modifica alerte
// si nu mai pune joburi in coada 'email'. Raman doar citirea abonatului (pagina /alerte/gestionare)
// si stergerea lui (dezabonare / „Șterge-mi datele acum”), pana la stergerea tuturor datelor
// (worker: npm run alerte:ramas-bun -- --purge --confirm).

import pool from './db'

export async function getSubscriber(subscriberId: number): Promise<{ id: number; email: string } | null> {
  const { rows } = await pool.query(`SELECT id, email FROM email_subscribers WHERE id = $1`, [subscriberId])
  return rows[0] ?? null
}

// Dezabonare totala = stergere completa: abonatul si toate alertele lui (ON DELETE CASCADE)
export async function deleteSubscriber(subscriberId: number): Promise<void> {
  await pool.query(`DELETE FROM email_subscribers WHERE id = $1`, [subscriberId])
}
