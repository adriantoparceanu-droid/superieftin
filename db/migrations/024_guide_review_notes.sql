-- 024: Fisa de verificare pentru ghidurile scrise de AI
--
-- De ce: ciornele de ghiduri sunt scrise de Claude (importate cu `npm run ghiduri:import`),
-- iar proprietarul doar le verifica si le publica. Fisa (afirmatii + surse, avertismente,
-- checklist) apare in editorul din /admin/ghiduri/[id] langa text.
--
-- review_notes NU este public: nu apare pe pagina ghidului, in JSON-LD, llms.txt sau sitemap
-- (query-urile publice selecteaza coloanele explicit, fara g.*).
--   { "facts": [{ "claim", "source_type": "db|web", "source", "status": "confirmat|de_verificat", "note"? }],
--     "checklist": ["..."], "warnings": ["..."] }
-- generated_by: cine a scris ciorna (ex. 'claude') — transparenta interna, eticheta in lista din admin.
--
-- Idempotenta: poate rula de mai multe ori fara efect.

ALTER TABLE guides ADD COLUMN IF NOT EXISTS review_notes JSONB;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS generated_by TEXT;
