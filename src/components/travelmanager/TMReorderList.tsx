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
 * Two things make it feel deliberate rather than twitchy, both standard in
 * drag libraries and both absent from the first version:
 *
 *  - **An activation threshold.** A press does nothing until the pointer has
 *    travelled `THRESHOLD_PX`. Without it every stray tap reordered the list,
 *    because the first pointermove of a normal tap is enough to swap rows.
 *  - **A dedicated handle.** Only the grip starts a drag, so the rest of the
 *    row stays tappable and — critically — the page still scrolls when you
 *    swipe over the list. `touch-action: none` belongs on the handle alone;
 *    on the whole row it traps the scroll gesture.
 *
 * Dependency-free on purpose: these lists are a few rows of equal height, so
 * "which row am I over" is arithmetic. Variable heights or nesting would
 * justify a library; this doesn't.
 */

/** How far the pointer must move before a press becomes a drag. */
const THRESHOLD_PX = 6;

export function TMReorderList<T extends { key: string }>({
  items,
  onReorder,
  rowHeight = 56,
  renderItem,
}: {
  items: T[];
  /** Called on drop, and only when the order actually changed. */
  onReorder: (keys: string[]) => void;
  /** Fixed row height in px — rows must all match for the index maths to hold. */
  rowHeight?: number;
  /**
   * `handleProps` must be spread onto the grip element; nothing else starts a
   * drag. `dragging` is for styling the lifted row.
   */
  renderItem: (
    item: T,
    state: { dragging: boolean; handleProps: React.HTMLAttributes<HTMLElement> },
  ) => React.ReactNode;
}) {
  // `order` is the live preview during a drag; `items` stays the source of
  // truth until drop, so an abandoned drag leaves nothing behind.
  const [order, setOrder] = useState<string[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [offset, setOffset] = useState(0);
  const startY = useRef(0);
  const startIndex = useRef(0);
  const initialOrder = useRef<string[]>([]);

  const keys = order ?? items.map((i) => i.key);
  const byKey = new Map(items.map((i) => [i.key, i]));

  // The key comes from the DOM rather than a closure, so `handleProps` can be
  // one static object. A per-key closure would reach these refs, and building
  // one inside the render body trips React's "no ref access during render".
  const keyFromEvent = (e: React.PointerEvent) =>
    (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-reorder-key]')?.dataset.reorderKey ?? null;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const key = keyFromEvent(e);
      if (!key) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      startIndex.current = keys.indexOf(key);
      initialOrder.current = keys;
      setActiveKey(key);
      setEngaged(false); // not a drag until the threshold is crossed
      setOffset(0);
    },
    [keys],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeKey) return;
      const dy = e.clientY - startY.current;

      if (!engaged) {
        if (Math.abs(dy) < THRESHOLD_PX) return; // still just a press
        setEngaged(true);
        setOrder(initialOrder.current);
      }

      setOffset(dy);
      const target = Math.max(
        0,
        Math.min(items.length - 1, Math.round(startIndex.current + dy / rowHeight)),
      );
      const current = keys.indexOf(activeKey);
      if (target !== current) {
        const next = [...keys];
        next.splice(current, 1);
        next.splice(target, 0, activeKey);
        setOrder(next);
        // Re-anchor so the row keeps tracking the pointer after the swap.
        startY.current = e.clientY;
        startIndex.current = target;
        setOffset(0);
      }
    },
    [activeKey, engaged, items.length, keys, rowHeight],
  );

  const endDrag = useCallback(() => {
    if (!activeKey) return;
    // Commit only a real reorder — a press that never crossed the threshold,
    // or one that ended where it started, must not look like an edit.
    if (engaged && order && order.join() !== initialOrder.current.join()) {
      onReorder(order);
    }
    setActiveKey(null);
    setEngaged(false);
    setOrder(null);
    setOffset(0);
  }, [activeKey, engaged, onReorder, order]);


  return (
    <ul className="select-none">
      {keys.map((key) => {
        const it = byKey.get(key);
        if (!it) return null;
        return (
          <Row
            key={key}
            itemKey={key}
            rowHeight={rowHeight}
            dragging={engaged && activeKey === key}
            offset={offset}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onEnd={endDrag}
          >
            {(handleProps, dragging) => renderItem(it, { dragging, handleProps })}
          </Row>
        );
      })}
    </ul>
  );
}

/**
 * One row. Owns the handler object it spreads onto the drag handle, so the
 * list's own render never constructs a closure that reaches its refs.
 */
function Row({
  itemKey,
  rowHeight,
  dragging,
  offset,
  onPointerDown,
  onPointerMove,
  onEnd,
  children,
}: {
  itemKey: string;
  rowHeight: number;
  dragging: boolean;
  offset: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onEnd: () => void;
  children: (handleProps: React.HTMLAttributes<HTMLElement>, dragging: boolean) => React.ReactNode;
}) {
  const handleProps: React.HTMLAttributes<HTMLElement> = {
    onPointerDown: (e) => onPointerDown(e as React.PointerEvent),
    onPointerMove: (e) => onPointerMove(e as React.PointerEvent),
    onPointerUp: onEnd,
    onPointerCancel: onEnd,
    // Only the handle opts out of native gestures, so a swipe anywhere else on
    // the row still scrolls the page.
    style: { touchAction: 'none' },
  };

  return (
    <li
      data-reorder-key={itemKey}
      style={{
        height: rowHeight,
        transform: dragging ? `translateY(${offset}px)` : undefined,
        zIndex: dragging ? 10 : undefined,
        position: dragging ? 'relative' : undefined,
      }}
      className={`flex items-center ${dragging ? 'rounded-[10px] bg-tm-wash shadow-tm-card-hover' : ''}`}
    >
      {children(handleProps, dragging)}
    </li>
  );
}
