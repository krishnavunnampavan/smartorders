"""
WebSocket router for real-time cart sync.

Single /ws/cart endpoint; all connected clients share the same cart view.
broadcast_event() is called by cart_service after every mutation.
Optional Redis pub/sub lets multiple backend workers stay in sync.
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.database import SessionLocal
import app.services.cart_service as cart_service

log = logging.getLogger(__name__)
router = APIRouter()

# ── In-memory connection registry ────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            try:
                self.active.remove(ws)
            except ValueError:
                pass

    async def broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        text = json.dumps(payload)
        async with self._lock:
            targets = list(self.active)
        for ws in targets:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self.active)


manager = ConnectionManager()

# ── Optional Redis pub/sub ────────────────────────────────────────────────────

_redis_client: Optional[object] = None
_CHANNEL = "cart_events"


async def _get_redis():
    """Return async Redis client, or None if unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from app.config import settings
        url = getattr(settings, "REDIS_URL", None)
        if not url:
            return None
        import redis.asyncio as aioredis
        client = aioredis.from_url(url, decode_responses=True)
        await client.ping()
        _redis_client = client
        log.info("Redis pub/sub connected: %s", url)
        return client
    except Exception as exc:
        log.debug("Redis not available (%s); using in-memory only", exc)
        return None


async def _publish_to_redis(event: dict) -> None:
    client = await _get_redis()
    if client:
        try:
            await client.publish(_CHANNEL, json.dumps(event))
        except Exception as exc:
            log.debug("Redis publish failed: %s", exc)


async def redis_listener() -> None:
    """Background task — subscribe to Redis channel and forward to local clients."""
    client = await _get_redis()
    if not client:
        return
    try:
        pubsub = client.pubsub()
        await pubsub.subscribe(_CHANNEL)
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    event = json.loads(message["data"])
                    await manager.broadcast(event)
                except Exception:
                    pass
    except Exception as exc:
        log.warning("Redis listener stopped: %s", exc)


# ── Public broadcast helper ───────────────────────────────────────────────────

async def broadcast_event(event: dict) -> None:
    """
    Called by cart_service after every mutation.
    Broadcasts to all in-memory WebSocket connections and publishes to Redis
    so other backend workers can forward to their own connections.
    """
    await manager.broadcast(event)
    await _publish_to_redis(event)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/cart")
async def cart_ws(ws: WebSocket):
    await manager.connect(ws)

    # Send full cart state on connect
    db = SessionLocal()
    try:
        cart_state = cart_service.get_active_cart_full(db)
        await ws.send_text(json.dumps({
            "type": "CART_STATE",
            "cart": cart_state,
            "connection_count": manager.count,
        }))
    finally:
        db.close()

    # Announce new connection count
    await manager.broadcast({"type": "CONNECTION_COUNT", "count": manager.count})

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)
        await manager.broadcast({"type": "CONNECTION_COUNT", "count": manager.count})
