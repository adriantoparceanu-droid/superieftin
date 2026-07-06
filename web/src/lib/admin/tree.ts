// Logica pură pentru arbori cu drag-and-drop (folosită de MenuBuilder și CategoryBuilder).
// Fără React / dnd-kit aici — doar transformări pe liste plate cu (id, parentId, depth).

export interface TreeBase { id: number; parentId: number | null }
export type WithDepth<T> = T & { depth: number }

// arrayMove local (ca să nu legăm fișierul de @dnd-kit)
export function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

// Listă plată în pre-ordine (părinte urmat de copii), cu depth. Items vin deja sortate
// (parent NULLS FIRST, sort_order), deci grupele păstrează ordinea corectă.
export function buildFlat<T extends TreeBase>(items: T[]): WithDepth<T>[] {
  const byParent = new Map<number | null, T[]>()
  for (const it of items) {
    const arr = byParent.get(it.parentId) ?? []
    arr.push(it)
    byParent.set(it.parentId, arr)
  }
  const out: WithDepth<T>[] = []
  const walk = (parentId: number | null, depth: number) => {
    for (const it of byParent.get(parentId) ?? []) {
      out.push({ ...it, depth })
      walk(it.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

// Ids din subarborele unui nod (nodul + descendenții lui, contigui în pre-ordine).
export function subtreeIds<T extends WithDepth<TreeBase>>(flat: T[], rootId: number): Set<number> {
  const ids = new Set<number>([rootId])
  const idx = flat.findIndex((f) => f.id === rootId)
  if (idx === -1) return ids
  const rootDepth = flat[idx].depth
  for (let i = idx + 1; i < flat.length && flat[i].depth > rootDepth; i++) ids.add(flat[i].id)
  return ids
}

// Înălțimea subarborelui unui nod (0 = frunză), pentru a nu împinge descendenții peste limită.
function subtreeHeight<T extends WithDepth<TreeBase>>(flat: T[], rootId: number): number {
  const idx = flat.findIndex((f) => f.id === rootId)
  if (idx === -1) return 0
  const rootDepth = flat[idx].depth
  let maxRel = 0
  for (let i = idx + 1; i < flat.length && flat[i].depth > rootDepth; i++) {
    maxRel = Math.max(maxRel, flat[i].depth - rootDepth)
  }
  return maxRel
}

// Recalculează depth din lanțul de părinți (după ce parentId s-a schimbat).
export function recomputeDepths<T extends TreeBase>(flat: T[]): WithDepth<T>[] {
  const byId = new Map(flat.map((f) => [f.id, f]))
  const depthOf = (f: TreeBase): number => {
    let d = 0
    let p = f.parentId
    const seen = new Set<number>()
    while (p != null && byId.has(p) && !seen.has(p)) { seen.add(p); d++; p = byId.get(p)!.parentId }
    return d
  }
  return flat.map((f) => ({ ...f, depth: depthOf(f) }))
}

// Proiecția adâncimii + părintelui în timpul drag-ului (pattern dnd-kit sortable tree),
// cu gardă pe înălțimea subarborelui ca descendenții să nu depășească maxDepth.
export function getProjection<T extends WithDepth<TreeBase>>(
  items: T[], activeId: number, overId: number, dragOffset: number, indent: number, maxDepth: number,
): { depth: number; parentId: number | null } {
  const overIndex = items.findIndex((i) => i.id === overId)
  const activeIndex = items.findIndex((i) => i.id === activeId)
  const activeItem = items[activeIndex]
  const newItems = arrayMove(items, activeIndex, overIndex)
  const prevItem = newItems[overIndex - 1]
  const nextItem = newItems[overIndex + 1]

  const projected = activeItem.depth + Math.round(dragOffset / indent)
  const effectiveMax = maxDepth - subtreeHeight(items, activeId)
  const maxD = prevItem ? Math.min(prevItem.depth + 1, effectiveMax) : 0
  const minD = nextItem ? nextItem.depth : 0
  const depth = Math.max(minD, Math.min(projected, Math.max(0, maxD)))

  let parentId: number | null = null
  if (depth > 0 && prevItem) {
    if (depth === prevItem.depth) parentId = prevItem.parentId
    else if (depth > prevItem.depth) parentId = prevItem.id
    else parentId = newItems.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null
  }
  return { depth, parentId }
}
