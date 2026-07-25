'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Drag-to-reorder for a short vertical list.
 *
 * Built on pointer events rather than the HTML5 drag-and-drop API, which does
 * not fire on iOS touch at all — and this list's whole purpose is configuring
 * the phone's tab bar. Pointer events give one code path for touch, pen and
 * mouse.
 *
 * Deliberately dependency-free: the lists here are three or four rows of equal
 * height, so "which row am I over" is arithmetic, not a layout engine. A
 * general solution (variable heights, nesting, scrolling containers) would
 * justify a library; this doesn't.
 */
export function TMReorderList<T extends { key: string }>({
  items,
  onReorder,
  rowHeight = 56,
  renderItem,
}: {
  items: T[];
  /** Called once, on drop, with the new order. */
  onReorder: (keys: string[]) => void;
  /** Fixed row height in px — rows must all match for the index maths to hold. */
  rowHeight?: number;
  renderItem: (item: T, state: { dragging: boolean }) => React.ReactNode;
}) {
  // `order` is the live preview during a drag; `items` remains the source of
  // truth until drop, so an abandoned drag leaves nothing behind.
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const startY = useRef(0);
  const startIndex = useRef(0);

  const keys = order ?? items.map((i) => i.key);
  const byKey = new Map(items.map((i) => [i.key, i]));

  const onPointerDown = useCallback(
    (e: React.PointerEvent, key: string) => {
      // Ignore secondary buttons; let normal clicks through on the row's own
      // controls (they stop propagation themselves).
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      startIndex.current = keys.indexOf(key);
      setDraggingKey(key);
      setOrder(keys);
      setOffset(0);
    },
    [keys],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingKey) return;
      const dy = e.clientY - startY.current;
      setOffset(dy);

      const target = Math.max(
        0,
        Math.min(items.length - 1, Math.round(startIndex.current + dy / rowHeight)),
      );
      const current = keys.indexOf(draggingKey);
      if (target !== current) {
        const next = [...keys];
        next.splice(current, 1);
        next.splice(target, 0, draggingKey);
        setOrder(next);
        // Re-anchor so the row keeps tracking the finger after the swap.
        startY.current = e.clientY;
        startIndex.current = target;
        setOffset(0);
      }
    },
    [draggingKey, items.length, keys, rowHeight],
  );

  const endDrag = useCallback(() => {
    if (!draggingKey) return;
    if (order) onReorder(order);
    setDraggingKey(null);
    setOrder(null);
    setOffset(0);
  }, [draggingKey, onReorder, order]);

  return (
    <ul className="select-none">
      {keys.map((key) => {
        const it = byKey.get(key);
        if (!it) return null;
        const dragging = draggingKey === key;
        return (
          <li
            key={key}
            onPointerDown={(e) => onPointerDown(e, key)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              height: rowHeight,
              // Only the row under the finger moves; the rest reflow by virtue
              // of the reordered array.
              transform: dragging ? `translateY(${offset}px)` : undefined,
              zIndex: dragging ? 10 : undefined,
              position: dragging ? 'relative' : undefined,
              // Stop the page scrolling out from under a drag on touch.
              touchAction: 'none',
            }}
            className={`flex items-center ${dragging ? 'cursor-grabbing rounded-[10px] bg-tm-wash shadow-tm-card-hover' : 'cursor-grab'}`}
          >
            {renderItem(it, { dragging })}
          </li>
        );
      })}
    </ul>
  );
}
