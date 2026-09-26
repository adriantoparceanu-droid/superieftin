// Datele firmei care opereaza superieftin.ro — apar pe Contact, Confidentialitate, Termeni.
// COMPLETEAZA valorile null. Cat timp o valoare e null, pe site apare „[DE COMPLETAT: …]”
// (galben), iar policy-reviewer nu da PASS — Google cere date reale de contact pe site.
export const COMPANY = {
  name: null as string | null,           // denumirea firmei, ex. 'Exemplu SRL'
  cui: null as string | null,            // CUI, ex. 'RO12345678'
  regCom: null as string | null,         // nr. Registrul Comertului, ex. 'J40/1234/2020'
  address: null as string | null,        // sediul social
  email: null as string | null,          // email de contact, ex. 'contact@superieftin.ro'
  privacyEmail: null as string | null,   // email pentru cereri GDPR (poate fi acelasi)
  hosting: null as string | null,        // furnizorul VPS + tara, ex. 'Hetzner Online GmbH (Germania)'
}
