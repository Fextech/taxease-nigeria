from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class HealthResponse(BaseModel):
    status: str


class ParsedTransaction(BaseModel):
    """A single parsed transaction from a bank statement."""

    transaction_date: datetime
    value_date: Optional[datetime] = None
    description: str
    credit_amount: int = 0  # In kobo (1 NGN = 100 kobo)
    debit_amount: int = 0  # In kobo
    balance: Optional[int] = None  # In kobo
    reference: Optional[str] = None
    channel: Optional[str] = None  # POS, Transfer, ATM, USSD, etc.
    confidence: float = 1.0  # 0.0 to 1.0


class ParseResult(BaseModel):
    """Result of parsing a bank statement."""

    bank_name: str
    transactions: list[ParsedTransaction]
    overall_confidence: float
    raw_text_preview: str
    row_count: int
    notes: Optional[str] = None


class ParseRequest(BaseModel):
    """Request body for parsing from raw text (alternative to file upload)."""

    raw_text: str
    filename: Optional[str] = None
