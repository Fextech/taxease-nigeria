"""
Text extraction utilities for PDF, CSV, and Excel bank statement files.
"""

import io
import logging
from typing import Optional

import pdfplumber
import pandas as pd

logger = logging.getLogger(__name__)


async def extract_text_from_pdf(file_bytes: bytes, password: str = "") -> str:
    """
    Extract all text from a PDF file using pdfplumber.
    Prioritises table extraction for structured bank statement data.
    """
    text_parts: list[str] = []

    try:
        with pdfplumber.open(io.BytesIO(file_bytes), password=password) as pdf:
            for i, page in enumerate(pdf.pages):
                # Try extracting tables first (better for bank statements)
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            if row:
                                cleaned = [
                                    (cell or "").strip() for cell in row
                                ]
                                if any(cleaned):
                                    text_parts.append("\t".join(cleaned))
                else:
                    # Fall back to raw text extraction
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)

                logger.debug(f"Processed PDF page {i + 1}/{len(pdf.pages)}")

    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise ValueError(f"Failed to read PDF file: {str(e)}")

    result = "\n".join(text_parts)

    if not result.strip():
        raise ValueError(
            "No text could be extracted from the PDF. "
            "The file may be scanned/image-based. "
            "Please upload a digitally-generated PDF statement."
        )

    logger.info(
        f"Extracted {len(result)} characters from PDF "
        f"({len(text_parts)} sections)"
    )
    return result


async def extract_text_from_csv(
    file_bytes: bytes, filename: Optional[str] = None
) -> str:
    """
    Read a CSV or Excel file and convert it to a tab-separated text
    representation suitable for Gemini parsing.
    """
    try:
        is_excel = filename and (
            filename.endswith(".xlsx") or filename.endswith(".xls")
        )

        if is_excel:
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            # Try common encodings for Nigerian bank CSVs
            for encoding in ["utf-8", "latin-1", "cp1252"]:
                try:
                    df = pd.read_csv(
                        io.BytesIO(file_bytes), encoding=encoding
                    )
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError(
                    "Could not decode CSV file with any supported encoding"
                )

        # Drop completely empty rows and columns
        df = df.dropna(how="all").dropna(axis=1, how="all")

        if df.empty:
            raise ValueError("The uploaded file contains no data rows.")

        # Convert to tab-separated text with headers
        header = "\t".join(str(col) for col in df.columns)
        rows = []
        for _, row in df.iterrows():
            rows.append(
                "\t".join(str(val) if pd.notna(val) else "" for val in row)
            )

        result = header + "\n" + "\n".join(rows)

        logger.info(
            f"Extracted {len(df)} rows and {len(df.columns)} columns "
            f"from {'Excel' if is_excel else 'CSV'} file"
        )
        return result

    except ValueError:
        raise
    except Exception as e:
        logger.error(f"CSV/Excel extraction failed: {e}")
        raise ValueError(f"Failed to read file: {str(e)}")
