/**
 * useCartSync — persistent WebSocket connection to /ws/cart.
 *
 * Handles:
 *  - Automatic reconnect with exponential back-off
 *  - Heartbeat ping every 30 s to keep connection alive
 *  - Dispatching all server-pushed events to orderStore
 */
import { useEffect, useRef } from 'react'
import { useOrderStore } from '../store/orderStore'

const WS_URL = (() => {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/cart`
})()

const PING_INTERVAL_MS = 30_000
const BASE_BACKOFF_MS  = 1_000
const MAX_BACKOFF_MS   = 30_000

export function useCartSync() {
  const setWsStatus        = useOrderStore((s) => s.setWsStatus)
  const setConnectionCount = useOrderStore((s) => s.setConnectionCount)
  const setItems           = useOrderStore((s) => s.setItems)
  const addItemFromServer  = useOrderStore((s) => s.addItemFromServer)
  const updateItemFromServer = useOrderStore((s) => s.updateItemFromServer)
  const removeItemFromServer = useOrderStore((s) => s.removeItemFromServer)
  const clearItemsFromServer = useOrderStore((s) => s.clearItemsFromServer)

  const wsRef      = useRef(null)
  const retryRef   = useRef(0)
  const pingRef    = useRef(null)
  const unmountRef = useRef(false)

  useEffect(() => {
    unmountRef.current = false

    function connect() {
      if (unmountRef.current) return

      setWsStatus('connecting')
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        retryRef.current = 0
        setWsStatus('connected')

        // heartbeat
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
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
          case 'ITEM_ADDED':
            addItemFromServer(msg.item)
            break
          case 'ITEM_UPDATED':
            updateItemFromServer(msg.item)
            break
          case 'ITEM_REMOVED':
            removeItemFromServer(msg.item_id)
            break
          case 'CART_CLEARED':
            clearItemsFromServer()
            break
          case 'CONNECTION_COUNT':
            setConnectionCount(msg.count)
            break
          case 'pong':
            break
          default:
            break
        }
      }

      ws.onclose = () => {
        clearInterval(pingRef.current)
        if (unmountRef.current) return

        setWsStatus('disconnected')
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** retryRef.current, MAX_BACKOFF_MS)
        retryRef.current += 1
        setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      unmountRef.current = true
      clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
