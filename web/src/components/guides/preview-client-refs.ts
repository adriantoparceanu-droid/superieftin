// De ce exista fisierul: previzualizarea din editor (previewGuideAction) intoarce JSX randat pe
// server, care contine componente client (butoanele spre magazine). React le
// poate trimite browserului doar daca pagina care cheama actiunea le are in „client manifest” —
// adica daca pagina le importa. Paginile de editor (admin/ghiduri/nou si [id]) importa acest
// fisier; fara el, previzualizarea da eroarea „Could not find the module … in the React Client
// Manifest”. Orice componenta client noua folosita in GuideBody se adauga si aici.
// (ProductPick e componenta de server; singura componenta client din ea e AffiliateLink.)
import { AffiliateLink } from '@/components/analytics/AffiliateLink'

export const PREVIEW_CLIENT_REFS = [AffiliateLink]
