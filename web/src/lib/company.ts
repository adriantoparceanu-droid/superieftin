// Datele firmei care opereaza superieftin.ro — apar pe Contact, Confidentialitate, Termeni.
// COMPLETEAZA valorile null. Cat timp o valoare e null, pe site apare „[DE COMPLETAT: …]”
// (galben), iar policy-reviewer nu da PASS — Google cere date reale de contact pe site.
export const COMPANY = {
  name: 'Digital Pro Shop SRL' as string | null,           // denumirea firmei, ex. 'Exemplu SRL'
  cui: '50523367' as string | null,            // CUI, ex. 'RO12345678'
  regCom: 'J2024020841007' as string | null,         // nr. Registrul Comertului, ex. 'J40/1234/2020'
  address: 'București, Mihai Bravu 85-93' as string | null,        // sediul social
  email: 'contact@superieftin.ro' as string | null,          // email de contact, ex. 'contact@superieftin.ro'
  privacyEmail: 'contact@superieftin.ro' as string | null,   // email pentru cereri GDPR (poate fi acelasi)
  hosting: 'Contabo GmbH, server în Franța (UE)' as string | null,        // furnizorul VPS + tara, ex. 'Hetzner Online GmbH (Germania)'
}
