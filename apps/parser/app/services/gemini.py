"""
Gemini AI service for extracting structured transaction data from bank statement text.
Uses the Google GenAI SDK (google-genai) for Gemini 2.0 Flash / 1.5 Pro.
"""

import json
import os
import logging
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

logger = logging.getLogger(__name__)

# ─── Load Environment Variables ─────────────────────────────
# Find the root .env file
root_env_path = Path(__file__).resolve().parent.parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=root_env_path)

# ─── Client Initialisation ───────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_ID = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# ─── System Prompt ────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert financial data extraction system specialising in Nigerian bank statements.

Your task: Given the raw text of a bank statement, extract every transaction into a structured JSON array.

RULES:
1. Each transaction must have these fields:
   - "transaction_date": ISO 8601 date string (YYYY-MM-DD). Infer the year from the statement header if only day/month are shown.
   - "value_date": ISO 8601 date string or null if not available.
   - "description": The narration/description exactly as shown.
   - "credit_amount": Integer amount in kobo (1 NGN = 100 kobo). 0 if not a credit.
   - "debit_amount": Integer amount in kobo. 0 if not a debit.
   - "balance": Integer balance in kobo after the transaction, or null if not shown.
   - "reference": Transaction reference string or null.
   - "channel": One of "POS", "Transfer", "ATM", "USSD", "Web", "Mobile", "Cheque", "Direct Debit", "Standing Order", "Other", or null.
   - "confidence": Float 0.0-1.0 indicating how confident you are in this row's accuracy.

2. Convert all Naira amounts to kobo by multiplying by 100. For example: ₦1,500.50 → 150050
3. If a row is ambiguous, still include it but set confidence lower.
4. Identify the bank name from the statement header/footer, especially from the contact information.
5. Do NOT fabricate transactions. Only extract what is in the text.

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "bank_name": "string",
  "transactions": [ ... array of transaction objects ... ],
  "overall_confidence": 0.0-1.0,
  "notes": "any observations about the statement quality"
}
"""


# ─── Extraction Function ─────────────────────────────────


class TransactionSchema(BaseModel):
    transaction_date: str
    value_date: Optional[str] = None
    description: str
    credit_amount: int
    debit_amount: int
    balance: Optional[int] = None
    reference: Optional[str] = None
    channel: Optional[str] = None
    confidence: float

class StatementSchema(BaseModel):
    bank_name: str
    transactions: List[TransactionSchema]
    overall_confidence: float
    notes: Optional[str] = None

async def extract_transactions(raw_text: str) -> dict:
    """
    Send raw statement text to Gemini and return structured transaction data.
    """
    if not client:
        logger.warning("Gemini API key not configured — returning empty result")
        return {
            "bank_name": "Unknown",
            "transactions": [],
            "overall_confidence": 0.0,
            "notes": "Gemini API key not configured. Set GEMINI_API_KEY in environment.",
        }

    if not raw_text.strip():
        return {
            "bank_name": "Unknown",
            "transactions": [],
            "overall_confidence": 0.0,
            "notes": "No text content found in the uploaded file.",
        }

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL_ID,
            contents=raw_text,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=StatementSchema,
            ),
        )

        # Parse the JSON response
        result_text = response.text.strip()

        # Strip markdown code fences if present
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1])

        result = json.loads(result_text)

        # Validate structure
        if "transactions" not in result:
            result["transactions"] = []
        if "bank_name" not in result:
            result["bank_name"] = "Unknown"
        if "overall_confidence" not in result:
            result["overall_confidence"] = 0.5

        logger.info(
            f"Gemini extracted {len(result['transactions'])} transactions "
            f"from {result['bank_name']} statement "
            f"(confidence: {result['overall_confidence']:.2f})"
        )

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        return {
            "bank_name": "Unknown",
            "transactions": [],
            "overall_confidence": 0.0,
            "notes": f"Failed to parse AI response: {str(e)}",
        }
    except Exception as e:
        logger.error(f"Gemini extraction failed: {e}")
        return {
            "bank_name": "Unknown",
            "transactions": [],
            "overall_confidence": 0.0,
            "notes": f"AI extraction error: {str(e)}",
        }
