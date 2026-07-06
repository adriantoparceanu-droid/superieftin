'use client'

import { useMemo, useState, useTransition } from 'react'
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
import { reorderMenuAction, toggleMenuItemAction, deleteMenuItemAction } from '@/lib/admin/actions'
import { buildFlat, recomputeDepths, subtreeIds, getProjection, type WithDepth } from '@/lib/admin/tree'
import type { AdminMenuItem } from '@/lib/admin/queries'

const INDENT = 24          // px per nivel
const MAX_DEPTH = 2        // 0..2 => 3 niveluri

interface MenuNode {
  id: number
  parentId: number | null
  label: string
  categorySlug: string | null
  url: string | null
  isVisible: boolean
}
type FlatItem = WithDepth<MenuNode>

const toNodes = (items: AdminMenuItem[]): MenuNode[] =>
  items.map((it) => ({
    id: it.id, parentId: it.parent_id, label: it.label,
    categorySlug: it.category_slug, url: it.url, isVisible: it.is_visible,
  }))

export function MenuBuilder({ initialItems }: { initialItems: AdminMenuItem[] }) {
  const [items, setItems] = useState<FlatItem[]>(() => buildFlat(toNodes(initialItems)))
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

  const persist = (flat: FlatItem[]) => {
    const payload = flat.map((f, idx) => ({ id: f.id, parentId: f.parentId, sortOrder: idx }))
    startTransition(() => { reorderMenuAction(payload) })
  }

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
    persist(next)
  }

  const toggleVisibility = (id: number) => {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, isVisible: !f.isVisible } : f)))
    const fd = new FormData(); fd.set('id', String(id))
    startTransition(() => { toggleMenuItemAction(fd) })
  }

  const removeItem = (id: number) => {
    const toRemove = subtreeIds(items, id)
    if (toRemove.size > 1 && !confirm('Itemul are subitemi — se șterge tot subarborele. Continui?')) return
    setItems((prev) => prev.filter((f) => !toRemove.has(f.id)))
    const fd = new FormData(); fd.set('id', String(id))
    startTransition(() => { deleteMenuItemAction(fd) })
  }

  if (!items.length) {
    return <div className="bg-white border border-line rounded-xl p-6 text-center text-muted">Meniul e gol.</div>
  }

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <DndContext
        id="menu-builder"
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
              onToggle={toggleVisibility}
              onDelete={removeItem}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableRow({
  item, depth, onToggle, onDelete,
}: {
  item: FlatItem; depth: number; onToggle: (id: number) => void; onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Translate.toString(transform), transition, paddingLeft: depth * INDENT + 12 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 border-t border-line py-2 pr-3 text-sm bg-white ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab text-muted hover:text-brand px-1 touch-none"
        title="Trage pentru a muta / imbrica"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className={`font-medium ${item.isVisible ? '' : 'text-muted line-through'}`}>{item.label}</span>
      <span className="text-xs text-muted">{item.categorySlug ? `/c/${item.categorySlug}` : item.url}</span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={() => onToggle(item.id)} className="px-1" title={item.isVisible ? 'Ascunde' : 'Afișează'}>
          {item.isVisible ? '👁' : '🚫'}
        </button>
        <button type="button" onClick={() => onDelete(item.id)} className="text-red-600 text-xs hover:underline px-1">
          șterge
        </button>
      </div>
    </div>
  )
}
