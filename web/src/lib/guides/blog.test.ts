// Teste pentru logica paginilor de blog (lib/guides/blog.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  themeGuides, subthemeHasOwnPage, guideSlugFromPath, mostReadGuides, homeSelection,
  readingMinutes, articleType, searchWords, UNACCENT_FROM, UNACCENT_TO, type BlogGuide,
} from './blog'

function g(slug: string, over: Partial<BlogGuide> = {}): BlogGuide {
  return {
    slug, title: slug, meta_description: null,
    published_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z',
    category_slug: null, category_ids: [], image_url: null, words: 1000, author_name: null,
    ...over,
  }
}

// Parinte 26 (telefoane-accesorii) cu subcategoriile 1 (telefoane-mobile) si 2 (casti)
const PARENT = { id: 26, slug: 'telefoane-accesorii', childIds: [1, 2], childSlugs: ['telefoane-mobile', 'casti'] }

test('themeGuides: prin produse (tema sau subcategoriile ei) sau prin category_slug', () => {
  const list = [
    g('prin-produs-sub', { category_ids: [1], updated_at: '2026-11-03T00:00:00Z' }),
    g('prin-produs-parinte', { category_ids: [26], updated_at: '2026-11-02T00:00:00Z' }),
    g('prin-slug', { category_slug: 'casti', updated_at: '2026-11-05T00:00:00Z' }),
    g('alta-tema', { category_ids: [99], category_slug: 'tv-audio' }),
    g('fara-nimic'),
  ]
  assert.deepEqual(themeGuides(list, PARENT).map((x) => x.slug), ['prin-slug', 'prin-produs-sub', 'prin-produs-parinte'])
  // Pe subcategorie: doar articolele ei
  assert.deepEqual(themeGuides(list, { id: 1, slug: 'telefoane-mobile' }).map((x) => x.slug), ['prin-produs-sub'])
})

test('themeGuides: un articol cu produse din mai multe teme apare in fiecare, o singura data', () => {
  const list = [g('mixt', { category_ids: [1, 2, 99] })]
  assert.equal(themeGuides(list, PARENT).length, 1)
  assert.equal(themeGuides(list, { id: 99, slug: 'tv-audio' }).length, 1)
})

test('subthemeHasOwnPage: de la 3 articole proprii', () => {
  assert.equal(subthemeHasOwnPage(0), false)
  assert.equal(subthemeHasOwnPage(2), false)
  assert.equal(subthemeHasOwnPage(3), true)
})

test('guideSlugFromPath: doar articole, fara metodologie / feed / imagini / alte pagini', () => {
  assert.equal(guideSlugFromPath('/ghiduri/telefoane-bune'), 'telefoane-bune')
  assert.equal(guideSlugFromPath('/ghiduri/telefoane-bune/'), 'telefoane-bune')
  assert.equal(guideSlugFromPath('/ghiduri/telefoane-bune?utm_source=x'), 'telefoane-bune')
  for (const p of ['/ghiduri', '/ghiduri/', '/ghiduri/metodologie', '/ghiduri/feed.xml', '/ghiduri/x/opengraph-image', '/p/x', '/']) {
    assert.equal(guideSlugFromPath(p), null, p)
  }
})

test('mostReadGuides: sortate dupa vizualizari pe 30 de zile, doar articole publicate', () => {
  const guides = [g('a'), g('b'), g('c'), g('d'), g('e')]
  const rows = [
    { path: '/ghiduri/b', views: 10 }, { path: '/ghiduri/b/', views: 5 },   // aceeasi pagina, adunate
    { path: '/ghiduri/c', views: 12 },
    { path: '/ghiduri/sters', views: 100 },                                // nepublicat → ignorat
    { path: '/p/produs', views: 50 },
    { path: '/ghiduri/a', views: 1 },
    { path: '/ghiduri/d', views: 3 },
  ]
  assert.deepEqual(mostReadGuides(rows, guides).map((x) => x.slug), ['b', 'c', 'd', 'a'])
})

test('mostReadGuides: fara date → cele mai noi; date putine → completate cu cele mai noi', () => {
  const guides = [
    g('vechi', { updated_at: '2026-10-01T00:00:00Z' }),
    g('nou', { updated_at: '2026-11-10T00:00:00Z' }),
    g('mijloc', { updated_at: '2026-11-01T00:00:00Z' }),
  ]
  assert.deepEqual(mostReadGuides([], guides).map((x) => x.slug), ['nou', 'mijloc', 'vechi'])
  assert.deepEqual(mostReadGuides([{ path: '/ghiduri/vechi', views: 2 }], guides, 2).map((x) => x.slug), ['vechi', 'nou'])
})

test('homeSelection: principalul = cel mai recent actualizat; „Articole noi” fara el, dupa publicare', () => {
  const guides = [
    g('a', { published_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }),
    g('b', { published_at: '2026-10-01T00:00:00Z', updated_at: '2026-11-15T00:00:00Z' }),  // actualizat recent
    g('c', { published_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z' }),
  ]
  const { featured, latest } = homeSelection(guides)
  assert.equal(featured?.slug, 'b')
  assert.deepEqual(latest.map((x) => x.slug), ['c', 'a'])
  assert.deepEqual(homeSelection([]), { featured: null, latest: [] })
})

test('readingMinutes: ~200 cuvinte pe minut, minim 1', () => {
  assert.equal(readingMinutes(0), 1)
  assert.equal(readingMinutes(1000), 5)
  assert.equal(readingMinutes(1650), 8)
})

test('articleType: din titlu', () => {
  assert.equal(articleType('Xiaomi 15T vs 15T Pro: care merită'), 'Comparație')
  assert.equal(articleType('Merită Samsung Galaxy Z Fold7?'), 'Merită?')
  assert.equal(articleType('Telefoane bune sub 1.500 lei'), 'Top pe buget')
  assert.equal(articleType('Telefoane bune sub 2.000 lei: ce merită luat acum'), 'Top pe buget')
  assert.equal(articleType('Samsung Galaxy A17, A37, A57: care merită'), 'Merită?')
  assert.equal(articleType('Căști fără fir sub 500 lei'), 'Top pe buget')
  assert.equal(articleType('Cum alegi o baterie externă'), 'Ghid de alegere')
})

test('searchWords: fara diacritice, litere mici, fara caractere LIKE, fara dubluri', () => {
  assert.deepEqual(searchWords('  Căști  FĂRĂ fir '), ['casti', 'fara', 'fir'])
  assert.deepEqual(searchWords('100%_off a'), ['100', 'off'])
  assert.deepEqual(searchWords('tv tv'), ['tv'])
  assert.deepEqual(searchWords(''), [])
  assert.equal(searchWords('a b c d e f g h i j k l m n o p'.replace(/ /g, 'x ')).length, 8)
})

test('UNACCENT: aceleasi lungimi (translate din SQL)', () => {
  assert.equal([...UNACCENT_FROM].length, [...UNACCENT_TO].length)
})
