/**
 * useCartSync — persistent WebSocket connection to /ws/cart.
 *
 * In dev:  connects to same host (Vite proxies /ws → backend)
 * In prod: uses VITE_WS_URL env var if set (Railway backend), otherwise
 *          falls back to same host (works when backend is on Vercel too).
 *
 * When WebSocket is unavailable (e.g. Vercel serverless), the hook
 * gracefully degrades: shows "disconnected" status and polls the REST
 * API every 30s so the cart stays fresh without real-time sync.
 */
import { useEffect, useRef } from 'react'
import { useOrderStore } from '../store/orderStore'
import cartAPI from '../api/cart'

// In production you can point at a separate backend (Railway/Render) via env var
const WS_URL = (() => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/cart`
})()

const PING_INTERVAL_MS  = 30_000
const POLL_INTERVAL_MS  = 30_000   // REST polling when WS is unavailable
const BASE_BACKOFF_MS   = 1_000
const MAX_BACKOFF_MS    = 60_000   // cap retry at 1 minute on repeated failures
const MAX_RETRIES       = 8        // stop WS retries after this; switch to polling

export function useCartSync() {
  const setWsStatus          = useOrderStore((s) => s.setWsStatus)
  const setConnectionCount   = useOrderStore((s) => s.setConnectionCount)
  const setItems             = useOrderStore((s) => s.setItems)
  const addItemFromServer    = useOrderStore((s) => s.addItemFromServer)
  const updateItemFromServer = useOrderStore((s) => s.updateItemFromServer)
  const removeItemFromServer = useOrderStore((s) => s.removeItemFromServer)
  const clearItemsFromServer = useOrderStore((s) => s.clearItemsFromServer)
  const loadCart             = useOrderStore((s) => s.loadCart)

  const wsRef       = useRef(null)
  const retryRef    = useRef(0)
  const pingRef     = useRef(null)
  const pollRef     = useRef(null)
  const unmountRef  = useRef(false)
  const pollingMode = useRef(false)

  useEffect(() => {
    unmountRef.current  = false
    pollingMode.current = false

    function startPolling() {
      if (pollingMode.current) return
      pollingMode.current = true
      setWsStatus('disconnected')
      // Poll REST API periodically to keep cart in sync
      pollRef.current = setInterval(() => {
        if (!unmountRef.current) loadCart()
      }, POLL_INTERVAL_MS)
    }

    function connect() {
      if (unmountRef.current || pollingMode.current) return

      // Give up on WS after too many retries, switch to polling
      if (retryRef.current >= MAX_RETRIES) {
        startPolling()
        return
      }

      setWsStatus('connecting')
      let ws
      try {
        ws = new WebSocket(WS_URL)
      } catch {
        startPolling()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 0
        setWsStatus('connected')
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = (ev) => {
        let msg
        try { msg = JSON.parse(ev.data) } catch { return }

        switch (msg.type) {
          case 'CART_STATE':
            setItems(msg.cart?.items ?? [])
            if (msg.connection_count != null) setConnectionCount(msg.connection_count)
            break
          case 'ITEM_ADDED':     addItemFromServer(msg.item);         break
          case 'ITEM_UPDATED':   updateItemFromServer(msg.item);      break
          case 'ITEM_REMOVED':   removeItemFromServer(msg.item_id);   break
          case 'CART_CLEARED':   clearItemsFromServer();              break
          case 'CONNECTION_COUNT': setConnectionCount(msg.count);     break
          default: break
        }
      }

      ws.onclose = (ev) => {
        clearInterval(pingRef.current)
        if (unmountRef.current) return

        setWsStatus('disconnected')
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** retryRef.current, MAX_BACKOFF_MS)
        retryRef.current += 1
        setTimeout(connect, delay)
      }

      ws.onerror = () => { ws.close() }
    }

    connect()

    return () => {
      unmountRef.current = true
      clearInterval(pingRef.current)
      clearInterval(pollRef.current)
      wsRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
