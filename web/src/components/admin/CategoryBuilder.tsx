'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragMoveEvent, type DragEndEvent, type DragStartEvent, type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  reorderCategoriesAction, updateCategoryAction, toggleCategoryVisibilityAction, deleteCategoryAction,
} from '@/lib/admin/actions'
import { buildFlat, recomputeDepths, getProjection, type WithDepth } from '@/lib/admin/tree'
import { IconPicker } from '@/components/admin/IconPicker'
import type { AdminCategory } from '@/lib/admin/queries'

const INDENT = 24       // px per nivel
const MAX_DEPTH = 1     // 0..1 => 2 niveluri (categorie + subcategorie)

interface CatNode { id: number; parentId: number | null; cat: AdminCategory }
type FlatItem = WithDepth<CatNode>

const toNodes = (cats: AdminCategory[]): CatNode[] =>
  cats.map((c) => ({ id: c.id, parentId: c.parent_id, cat: c }))

export function CategoryBuilder({ categories }: { categories: AdminCategory[] }) {
  const [items, setItems] = useState<FlatItem[]>(() => buildFlat(toNodes(categories)))
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const projected = activeId != null && overId != null
    ? getProjection(items, Number(activeId), Number(overId), offsetLeft, INDENT, MAX_DEPTH)
    : null
  const ids = useMemo(() => items.map((i) => i.id), [items])

  const resetDrag = () => { setActiveId(null); setOverId(null); setOffsetLeft(0) }
  const onDragStart = ({ active }: DragStartEvent) => { setActiveId(active.id); setOverId(active.id) }
  const onDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x)
  const onDragOver = ({ over }: DragOverEvent) => setOverId(over?.id ?? null)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    resetDrag()
    if (!over || !projected) return
    const activeIndex = items.findIndex((i) => i.id === active.id)
    const overIndex = items.findIndex((i) => i.id === over.id)
    if (activeIndex === -1) return
    const moved = [...items]
    moved[activeIndex] = { ...moved[activeIndex], parentId: projected.parentId }
    const next = recomputeDepths(arrayMove(moved, activeIndex, overIndex))
    setItems(next)
    startTransition(() => {
      reorderCategoriesAction(next.map((f, idx) => ({ id: f.id, parentId: f.parentId, sortOrder: idx })))
    })
  }

  if (!items.length) {
    return <div className="bg-white border border-line rounded-xl p-6 text-center text-muted">Nicio categorie încă.</div>
  }

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <DndContext
        id="category-builder"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              depth={item.id === activeId && projected ? projected.depth : item.depth}
              allCategories={categories}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableRow({ item, depth, allCategories }: {
  item: FlatItem; depth: number; allCategories: AdminCategory[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Translate.toString(transform), transition, paddingLeft: depth * INDENT + 12 }
  const cat = item.cat

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 border-t border-line py-2 pr-3 text-sm bg-white ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab text-muted hover:text-brand px-1 touch-none shrink-0"
        title="Trage pentru a muta / imbrica"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {/* Editare iconiță + nume */}
      <form action={updateCategoryAction} className="flex items-center gap-2 flex-1 min-w-0">
        <input type="hidden" name="id" value={cat.id} />
        <input type="hidden" name="parent_id" value={cat.parent_id ?? ''} />
        <IconPicker defaultValue={cat.icon} />
        <input name="name" defaultValue={cat.name} className={`border border-line rounded px-2 py-1 text-sm flex-1 min-w-32 ${cat.is_visible ? '' : 'text-muted line-through'}`} />
        <button type="submit" className="text-xs text-brand hover:underline shrink-0">salvează</button>
      </form>

      <span className="text-xs text-muted shrink-0">/c/{cat.slug}</span>
      {/* Textul + întrebările frecvente afișate pe /c/<slug> (migrația 030) */}
      <Link href={`/admin/categorii/${cat.id}`} className="text-xs text-brand hover:underline shrink-0" title="Text și întrebări frecvente pe pagina categoriei">
        {cat.has_content ? 'text ✓' : 'text'}
      </Link>
      <span className="text-sm text-right shrink-0 w-16">{cat.product_count.toLocaleString('ro-RO')}</span>

      <div className="flex items-center gap-1 shrink-0">
        <form action={toggleCategoryVisibilityAction}>
          <input type="hidden" name="id" value={cat.id} />
          <button type="submit" className="px-1" title={cat.is_visible ? 'Ascunde' : 'Afișează'}>{cat.is_visible ? '👁' : '🚫'}</button>
        </form>
        <form action={deleteCategoryAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={cat.id} />
          <select name="reassign_to" className="border border-line rounded text-xs px-1 py-0.5" title="Mută produsele în...">
            <option value="">(nemapate)</option>
            {allCategories.filter((c) => c.id !== cat.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="text-red-600 text-xs hover:underline">șterge</button>
        </form>
      </div>
    </div>
  )
}
