"""Provider-neutral structured extraction for Nigerian bank statements."""

import asyncio
import json
import logging
from typing import Literal, Optional

import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert financial data extraction system specialising in Nigerian bank statements.

Given raw bank statement text, extract every transaction into the requested JSON schema.

Rules:
- Dates must use ISO 8601 (YYYY-MM-DD); infer the year from the statement header when needed.
- Preserve the narration exactly as shown.
- Return every monetary value in kobo (1 NGN = 100 kobo). Use 0 when an amount is not a credit/debit.
- Keep uncertain rows, but lower their confidence from 0.0 to 1.0.
- Identify the bank from the statement header or footer.
- Never invent transactions or fields that are not supported by the statement.
"""


class TransactionSchema(BaseModel):
    transaction_date: str
    value_date: Optional[str] = None
    description: str
    credit_amount: int
    debit_amount: int
    balance: Optional[int] = None
    reference: Optional[str] = None
    channel: Optional[str] = None
    confidence: float = Field(ge=0, le=1)


class StatementSchema(BaseModel):
    bank_name: str
    transactions: list[TransactionSchema]
    overall_confidence: float = Field(ge=0, le=1)
    notes: Optional[str] = None


class RuntimeAiConfig(BaseModel):
    provider: Literal["gemini", "openai", "nvidia_nim", "openrouter", "groq", "anthropic"]
    model: str = Field(min_length=1, max_length=160)
    apiKey: str = Field(min_length=10, max_length=500)


class AiProviderError(RuntimeError):
    """A provider failed without exposing credential material in the message."""


def _strict_statement_schema() -> dict:
    """JSON Schema accepted by Groq and Anthropic constrained decoding.

    Those providers require every object to be closed and every property to be
    required in strict mode. Fields that are optional in Banklens are therefore
    represented as nullable, then remain optional to callers after Pydantic
    validation.
    """
    nullable_string = {"anyOf": [{"type": "string"}, {"type": "null"}]}
    nullable_integer = {"anyOf": [{"type": "integer"}, {"type": "null"}]}
    transaction = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "transaction_date": {"type": "string"},
            "value_date": nullable_string,
            "description": {"type": "string"},
            "credit_amount": {"type": "integer"},
            "debit_amount": {"type": "integer"},
            "balance": nullable_integer,
            "reference": nullable_string,
            "channel": nullable_string,
            "confidence": {"type": "number"},
        },
        "required": [
            "transaction_date",
            "value_date",
            "description",
            "credit_amount",
            "debit_amount",
            "balance",
            "reference",
            "channel",
            "confidence",
        ],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "bank_name": {"type": "string"},
            "transactions": {"type": "array", "items": transaction},
            "overall_confidence": {"type": "number"},
            "notes": nullable_string,
        },
        "required": ["bank_name", "transactions", "overall_confidence", "notes"],
    }


def _strip_fences(value: str) -> str:
    value = value.strip()
    if value.startswith("```"):
        lines = value.split("\n")
        value = "\n".join(lines[1:-1])
    return value.strip()


def _safe_groq_error_detail(response: httpx.Response) -> str:
    """Return only bounded provider metadata; never log a request or raw body."""
    try:
        payload = response.json()
    except ValueError:
        return "non-JSON error response"

    error = payload.get("error") if isinstance(payload, dict) else None
    if not isinstance(error, dict):
        return "unstructured JSON error response"

    safe_fields = {
        field: str(error[field])[:240]
        for field in ("message", "type", "code", "param")
        if isinstance(error.get(field), (str, int, float, bool))
    }
    return json.dumps(safe_fields, ensure_ascii=True)[:500] or "structured error without safe details"


def _validate_result(value: str) -> dict:
    try:
        return StatementSchema.model_validate_json(_strip_fences(value)).model_dump()
    except ValidationError as error:
        raise AiProviderError("The model returned an invalid statement extraction payload.") from error


async def _extract_with_gemini(raw_text: str, config: RuntimeAiConfig) -> dict:
    client = genai.Client(api_key=config.apiKey)
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=config.model,
            contents=raw_text,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=StatementSchema,
            ),
        )
        return _validate_result(response.text or "")
    except AiProviderError:
        raise
    except Exception as error:
        raise AiProviderError("Gemini extraction request failed.") from error


def _openai_compatible_endpoint(provider: str) -> str:
    endpoints = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "nvidia_nim": "https://integrate.api.nvidia.com/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
    }
    return endpoints[provider]


async def _extract_with_openai_compatible(raw_text: str, config: RuntimeAiConfig) -> dict:
    schema = StatementSchema.model_json_schema()
    response_format: dict = {
        "type": "json_schema",
        "json_schema": {
            "name": "bank_statement_extraction",
            "strict": True,
            "schema": schema,
        },
    }

    # NVIDIA NIM's supported models vary. JSON mode keeps this provider useful
    # even where strict JSON-schema decoding is not available.
    if config.provider == "nvidia_nim":
        response_format = {"type": "json_object"}
    elif config.provider == "groq":
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "bank_statement_extraction",
                "strict": True,
                "schema": _strict_statement_schema(),
            },
        }

    headers = {
        "Authorization": f"Bearer {config.apiKey}",
        "Content-Type": "application/json",
    }
    if config.provider == "openrouter":
        headers["HTTP-Referer"] = "https://banklens.ng"
        headers["X-Title"] = "Banklens Nigeria"

    payload = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        "response_format": response_format,
    }
    if config.provider == "groq":
        # Groq's strict Structured Outputs are supported by the GPT-OSS models
        # exposed in the Admin catalogue. This budget accommodates a complete
        # monthly statement instead of allowing the JSON array to truncate.
        payload["temperature"] = 0.1
        payload["max_completion_tokens"] = 16384
        if config.model in {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}:
            # This applies only to GPT-OSS requests sent through Groq. It does
            # not change reasoning settings for any other provider or model.
            payload["reasoning_effort"] = "low"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
            response = await client.post(
                _openai_compatible_endpoint(config.provider),
                headers=headers,
                json=payload,
            )
        if response.is_error:
            if config.provider == "groq":
                logger.warning(
                    "groq returned HTTP %s: %s",
                    response.status_code,
                    _safe_groq_error_detail(response),
                )
            else:
                logger.warning("%s returned HTTP %s", config.provider, response.status_code)
            raise AiProviderError(f"{config.provider} extraction request failed ({response.status_code}).")

        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise AiProviderError("The model returned an empty statement extraction payload.")
        return _validate_result(content)
    except AiProviderError:
        raise
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise AiProviderError("The model returned an unexpected statement extraction payload.") from error
    except httpx.HTTPError as error:
        raise AiProviderError(f"{config.provider} extraction request failed.") from error


async def _extract_with_anthropic(raw_text: str, config: RuntimeAiConfig) -> dict:
    payload = {
        "model": config.model,
        "max_tokens": 16384,
        "temperature": 0.1,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": raw_text}],
        "output_config": {
            "format": {
                "type": "json_schema",
                "schema": _strict_statement_schema(),
            },
        },
    }
    headers = {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            )
        if response.is_error:
            logger.warning("anthropic returned HTTP %s", response.status_code)
            raise AiProviderError(f"anthropic extraction request failed ({response.status_code}).")

        payload_response = response.json()
        content_blocks = payload_response["content"]
        content = next(
            (
                block.get("text")
                for block in content_blocks
                if isinstance(block, dict) and block.get("type") == "text"
            ),
            None,
        )
        if not isinstance(content, str):
            raise AiProviderError("Anthropic returned an empty statement extraction payload.")
        return _validate_result(content)
    except AiProviderError:
        raise
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise AiProviderError("Anthropic returned an unexpected statement extraction payload.") from error
    except httpx.HTTPError as error:
        raise AiProviderError("Anthropic extraction request failed.") from error


async def extract_transactions(raw_text: str, runtime_config: dict) -> dict:
    """Extract statement rows using the active provider chosen in Admin settings."""
    if not raw_text.strip():
        return {
            "bank_name": "Unknown",
            "transactions": [],
            "overall_confidence": 0.0,
            "notes": "No text content found in the uploaded file.",
        }

    try:
        config = RuntimeAiConfig.model_validate(runtime_config)
    except ValidationError as error:
        raise AiProviderError("The worker did not provide a valid AI provider configuration.") from error

    if config.provider == "gemini":
        result = await _extract_with_gemini(raw_text, config)
    elif config.provider == "anthropic":
        result = await _extract_with_anthropic(raw_text, config)
    else:
        result = await _extract_with_openai_compatible(raw_text, config)

    logger.info(
        "%s/%s extracted %d transactions from %s (confidence %.2f)",
        config.provider,
        config.model,
        len(result["transactions"]),
        result["bank_name"],
        result["overall_confidence"],
    )
    return result
