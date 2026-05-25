/**
 * useCartSync — Cart synchronization hook.
 *
 * Default mode (Vercel / no VITE_WS_URL): pure REST polling.
 *   · Polls GET /api/cart every 8s when tab is visible.
 *   · Drops to 60s when tab is hidden (Page Visibility API).
 *   · Re-polls immediately when tab comes back into focus.
 *
 * Optional WebSocket mode: set VITE_WS_URL env var to a WS backend URL.
 *   · Tries WS up to 3 times, then permanently falls back to polling.
 *   · Polling fills the gap between WS failure and reconnect.
 */
import { useEffect, useRef } from 'react'
import { useOrderStore } from '../store/orderStore'

const POLL_ACTIVE_MS  = 8_000   // 8s while tab is visible
const POLL_IDLE_MS    = 60_000  // 60s while tab is hidden
const PING_MS         = 25_000
const MAX_WS_RETRIES  = 3

// Only attempt WebSocket when the caller explicitly provides a WS URL.
const WS_URL = import.meta.env.VITE_WS_URL || null

export function useCartSync() {
  const setWsStatus          = useOrderStore((s) => s.setWsStatus)
  const setConnectionCount   = useOrderStore((s) => s.setConnectionCount)
  const setItems             = useOrderStore((s) => s.setItems)
  const addItemFromServer    = useOrderStore((s) => s.addItemFromServer)
  const updateItemFromServer = useOrderStore((s) => s.updateItemFromServer)
  const removeItemFromServer = useOrderStore((s) => s.removeItemFromServer)
  const clearItemsFromServer = useOrderStore((s) => s.clearItemsFromServer)
  const loadCart             = useOrderStore((s) => s.loadCart)

  const timerRef   = useRef(null)
  const wsRef      = useRef(null)
  const pingRef    = useRef(null)
  const retriesRef = useRef(0)
  const deadRef    = useRef(false)

  useEffect(() => {
    deadRef.current = false

    // ── Polling ──────────────────────────────────────────────────────────────
    function scheduleNext() {
      clearTimeout(timerRef.current)
      const delay = document.hidden ? POLL_IDLE_MS : POLL_ACTIVE_MS
      timerRef.current = setTimeout(tick, delay)
    }

    function tick() {
      if (deadRef.current) return
      loadCart().finally(scheduleNext)
    }

    function startPolling() {
      setWsStatus('connected')  // treat polling as "live"
      loadCart()
      scheduleNext()
    }

    function onVisibility() {
      if (!document.hidden && !deadRef.current) {
        clearTimeout(timerRef.current)
        tick()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    // ── WebSocket (optional) ──────────────────────────────────────────────────
    function tryWS() {
      if (deadRef.current || retriesRef.current >= MAX_WS_RETRIES) {
        startPolling()
        return
      }

      setWsStatus('connecting')
      let ws
      try { ws = new WebSocket(WS_URL) } catch { startPolling(); return }
      wsRef.current = ws

      ws.onopen = () => {
        retriesRef.current = 0
        setWsStatus('connected')
        clearTimeout(timerRef.current)  // WS is live; stop polling timer
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
        }, PING_MS)
      }

      ws.onmessage = (ev) => {
        let msg
        try { msg = JSON.parse(ev.data) } catch { return }
        switch (msg.type) {
          case 'CART_STATE':
            setItems(msg.cart?.items ?? [])
            if (msg.connection_count != null) setConnectionCount(msg.connection_count)
            break
          case 'ITEM_ADDED':       addItemFromServer(msg.item);       break
          case 'ITEM_UPDATED':     updateItemFromServer(msg.item);    break
          case 'ITEM_REMOVED':     removeItemFromServer(msg.item_id); break
          case 'CART_CLEARED':     clearItemsFromServer();            break
          case 'CONNECTION_COUNT': setConnectionCount(msg.count);     break
          default: break
        }
      }

      ws.onclose = () => {
        clearInterval(pingRef.current)
        if (deadRef.current) return
        setWsStatus('disconnected')
        retriesRef.current += 1
        const delay = Math.min(1_000 * 2 ** retriesRef.current, 30_000)
        setTimeout(tryWS, delay)
        // Poll while waiting for WS reconnect
        scheduleNext()
      }

      ws.onerror = () => ws.close()
    }

    // ── Kick off ─────────────────────────────────────────────────────────────
    if (WS_URL) {
      tryWS()
    } else {
      startPolling()
    }

    return () => {
      deadRef.current = true
      clearTimeout(timerRef.current)
      clearInterval(pingRef.current)
      wsRef.current?.close()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
