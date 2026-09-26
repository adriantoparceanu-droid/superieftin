// De ce exista fisierul: previzualizarea din editor (previewGuideAction) intoarce JSX randat pe
// server, care contine componente client (graficul de pret, butoanele spre magazine). React le
// poate trimite browserului doar daca pagina care cheama actiunea le are in „client manifest” —
// adica daca pagina le importa. Paginile de editor (admin/ghiduri/nou si [id]) importa acest
// fisier; fara el, previzualizarea da eroarea „Could not find the module … in the React Client
// Manifest”. Orice componenta client noua folosita in GuideBody se adauga si aici.
import { PriceHistoryChart } from '@/components/PriceHistoryChart'
import { AffiliateLink } from '@/components/analytics/AffiliateLink'

export const PREVIEW_CLIENT_REFS = [PriceHistoryChart, AffiliateLink]
