import logging
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import ParseResult, ParsedTransaction, HealthResponse
from .services.gemini import extract_transactions
from .services.extractor import extract_text_from_pdf, extract_text_from_csv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Banklens Parser Service",
    description="PDF/CSV bank statement parser using Gemini AI for Nigerian bank statements",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok")


@app.get("/banks")
async def list_supported_banks():
    return {
        "banks": [
            {"name": "GTBank", "parser": "gemini", "confidence": "high"},
            {"name": "Access Bank", "parser": "gemini", "confidence": "high"},
            {"name": "First Bank", "parser": "gemini", "confidence": "high"},
            {"name": "Zenith Bank", "parser": "gemini", "confidence": "high"},
            {"name": "UBA", "parser": "gemini", "confidence": "high"},
            {"name": "Kuda", "parser": "gemini", "confidence": "high"},
            {"name": "Other", "parser": "gemini", "confidence": "medium"},
        ]
    }


@app.post("/check-password")
async def check_password(file: UploadFile = File(...), password: str = Form("")):
    """
    Fast endpoint to verify if a PDF password is correct.
    """
    if not file.filename.lower().endswith(".pdf"):
        return {"valid": True}
        
    file_bytes = await file.read()
    try:
        import pdfplumber
        import io
        with pdfplumber.open(io.BytesIO(file_bytes), password=password) as pdf:
            return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)}


@app.post("/parse", response_model=ParseResult)
async def parse_statement(
    file: UploadFile = File(...),
    password: str = Form("")
):
    """
    Parse a bank statement PDF, CSV, or Excel file and return
    structured transaction data extracted using Gemini AI.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_types = {
        "application/pdf": "pdf",
        "text/csv": "csv",
        "application/vnd.ms-excel": "csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    }

    file_type = allowed_types.get(file.content_type or "")
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, CSV, XLSX",
        )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    logger.info(
        f"Parsing {file.filename} ({file.content_type}, "
        f"{len(file_bytes)} bytes)"
    )

    # Step 1: Extract raw text from the file
    try:
        if file_type == "pdf":
            raw_text = await extract_text_from_pdf(file_bytes, password=password)
        else:
            raw_text = await extract_text_from_csv(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Step 1.5: Validate the document looks like a bank statement
    # This runs AFTER text extraction but BEFORE the Gemini API call to avoid
    # wasting Gemini quota on non-financial documents.
    BANK_STATEMENT_KEYWORDS = [
        # Generic financial terms
        "balance", "debit", "credit", "transaction", "account",
        "statement", "deposit", "withdrawal", "opening", "closing",
        "bank", "date", "amount", "narration", "description",
        "value date", "reference", "ledger", "teller", "transfer",
        "inflow", "outflow", "charge", "fee",
        # Nigerian bank names
        "gtbank", "guaranty trust", "access bank", "zenith bank",
        "first bank", "uba", "fcmb", "stanbic ibtc", "sterling bank",
        "union bank", "wema bank", "fidelity bank", "polaris bank",
        "opay", "kuda", "moniepoint", "palmpay", "carbon", "vfd",
        "providus", "jaiz", "taj bank", "standard chartered",
    ]

    def is_likely_bank_statement(text: str) -> bool:
        text_lower = text.lower()
        matches = sum(1 for kw in BANK_STATEMENT_KEYWORDS if kw in text_lower)
        return matches >= 3

    if not is_likely_bank_statement(raw_text):
        logger.warning(
            f"File '{file.filename}' failed bank statement keyword check — "
            f"rejecting with 422."
        )
        raise HTTPException(
            status_code=422,
            detail=(
                "The uploaded file does not appear to be a bank statement. "
                "Please upload a valid PDF bank statement downloaded directly "
                "from your bank's app or internet banking portal."
            ),
        )

    # Step 2: Send to Gemini for structured extraction
    gemini_result = await extract_transactions(raw_text)

    # Step 3: Convert Gemini output to Pydantic models
    transactions: list[ParsedTransaction] = []
    for tx in gemini_result.get("transactions", []):
        try:
            # Parse date strings into datetime objects
            tx_date = tx.get("transaction_date", "")
            if isinstance(tx_date, str):
                tx_date = datetime.fromisoformat(tx_date)

            val_date = tx.get("value_date")
            if isinstance(val_date, str) and val_date:
                val_date = datetime.fromisoformat(val_date)
            else:
                val_date = None

            transactions.append(
                ParsedTransaction(
                    transaction_date=tx_date,
                    value_date=val_date,
                    description=str(tx.get("description", "")),
                    credit_amount=int(tx.get("credit_amount", 0)),
                    debit_amount=int(tx.get("debit_amount", 0)),
                    balance=(
                        int(tx["balance"]) if tx.get("balance") is not None else None
                    ),
                    reference=tx.get("reference"),
                    channel=tx.get("channel"),
                    confidence=float(tx.get("confidence", 0.5)),
                )
            )
        except (ValueError, TypeError) as e:
            logger.warning(f"Skipping malformed transaction: {e}")
            continue

    # Build text preview (first 500 chars)
    preview = raw_text[:500] + ("..." if len(raw_text) > 500 else "")

    return ParseResult(
        bank_name=gemini_result.get("bank_name", "Unknown"),
        transactions=transactions,
        overall_confidence=gemini_result.get("overall_confidence", 0.0),
        raw_text_preview=preview,
        row_count=len(transactions),
        notes=gemini_result.get("notes"),
    )
