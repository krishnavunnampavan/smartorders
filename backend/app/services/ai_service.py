from __future__ import annotations
import json
import anthropic
from openai import OpenAI
from app.database import get_setting


class AIService:
    def __init__(self):
        self.openai_key = get_setting("openai_api_key")
        self.claude_key = get_setting("claude_api_key")
        self.preferred_provider = get_setting("preferred_ai_provider") or "auto"

    def get_active_provider(self) -> str:
        if self.preferred_provider == "openai" and self.openai_key:
            return "openai"
        if self.preferred_provider == "claude" and self.claude_key:
            return "claude"
        if self.openai_key:
            return "openai"
        if self.claude_key:
            return "claude"
        raise ValueError("No AI API key configured. Go to Settings to add one.")

    async def transcribe_audio(self, audio_bytes: bytes) -> str:
        if not self.openai_key:
            raise ValueError("Voice input requires an OpenAI API key.")
        client = OpenAI(api_key=self.openai_key)
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=("audio.webm", audio_bytes, "audio/webm"),
        )
        return transcript.text

    async def parse_order_text(self, raw_text: str, context_hints: str = "") -> list[dict]:
        hints_block = f"\n{context_hints}\n" if context_hints else ""
        prompt = f"""
Extract all product names and quantities from this liquor store order text.
Return ONLY a JSON array, no explanation, no markdown.
Format: [{{"name": "product name", "qty": number, "unit": "cases or bottles"}}]

If unit is not specified, assume cases.
Normalize product names (capitalize brand names).
{hints_block}
Text: {raw_text}
"""
        provider = self.get_active_provider()
        try:
            if provider == "openai":
                return await self._openai_parse(prompt)
            return await self._claude_parse(prompt)
        except Exception as e:
            if provider == "openai" and self.claude_key:
                return await self._claude_parse(prompt)
            if provider == "claude" and self.openai_key:
                return await self._openai_parse(prompt)
            raise e

    async def parse_catalog_image(self, image_base64: str, media_type: str) -> list[dict]:
        prompt = """
This is a liquor distributor product catalog or price list.
Extract ALL products with their prices.
Return ONLY a JSON array:
[{"name": "product name", "sku": "if visible", "unit_price": 0.00, "case_price": 0.00, "unit_size": "750ml"}]
No markdown, no explanation. Just the JSON array.
"""
        if self.claude_key:
            return await self._claude_vision_parse(image_base64, media_type, prompt)
        if self.openai_key:
            return await self._openai_vision_parse(image_base64, media_type, prompt)
        raise ValueError("No AI key available for image parsing.")

    async def parse_catalog_text(self, raw_text: str) -> list[dict]:
        prompt = f"""
This is text extracted from a liquor distributor price catalog.
Extract ALL products and their prices.
Return ONLY a JSON array:
[{{"name": "product name", "sku": "optional", "unit_price": 0.00, "case_price": 0.00, "unit_size": "750ml"}}]
No markdown. Just JSON.

Catalog text:
{raw_text[:8000]}
"""
        provider = self.get_active_provider()
        try:
            if provider == "openai":
                return await self._openai_parse(prompt)
            return await self._claude_parse(prompt)
        except Exception as e:
            if provider == "openai" and self.claude_key:
                return await self._claude_parse(prompt)
            if provider == "claude" and self.openai_key:
                return await self._openai_parse(prompt)
            raise e

    async def test_key(self, provider: str, key: str) -> bool:
        try:
            if provider == "openai":
                client = OpenAI(api_key=key)
                client.models.list()
                return True
            if provider == "claude":
                client = anthropic.Anthropic(api_key=key)
                client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=10,
                    messages=[{"role": "user", "content": "ping"}],
                )
                return True
        except Exception:
            return False
        return False

    async def _openai_parse(self, prompt: str) -> list[dict]:
        client = OpenAI(api_key=self.openai_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        text = response.choices[0].message.content.strip()
        # Strip possible markdown code fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)

    async def _claude_parse(self, prompt: str) -> list[dict]:
        client = anthropic.Anthropic(api_key=self.claude_key)
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)

    async def _claude_vision_parse(self, image_b64: str, media_type: str, prompt: str) -> list[dict]:
        client = anthropic.Anthropic(api_key=self.claude_key)
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)

    async def _openai_vision_parse(self, image_b64: str, media_type: str, prompt: str) -> list[dict]:
        client = OpenAI(api_key=self.openai_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                {"type": "text", "text": prompt},
            ]}],
            temperature=0,
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
