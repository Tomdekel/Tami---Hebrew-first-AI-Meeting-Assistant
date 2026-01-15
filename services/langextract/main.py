"""
FastAPI service for entity extraction using LangExtract.

Endpoints:
- POST /extract - Extract entities from transcript text
- GET /health - Health check
"""

import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from extractor import extract_entities

load_dotenv()

# Maximum transcript length (approximately 70k words)
MAX_TRANSCRIPT_LENGTH = 100_000

app = FastAPI(
    title="Tami Entity Extraction Service",
    description="LangExtract-powered entity extraction with source grounding",
    version="1.0.0",
)

# CORS configuration - use explicit origins
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-API-Key"],
)


async def verify_api_key(x_api_key: str = Header(None)):
    """Verify API key for protected endpoints."""
    expected_key = os.getenv("LANGEXTRACT_API_KEY")
    # Skip auth if no key configured (local dev) or key matches
    if expected_key and x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class ExtractionRequest(BaseModel):
    """Request body for entity extraction."""

    transcript: str = Field(..., description="The transcript text to extract entities from")
    language: str = Field(default="en", description="Language code (en or he)")


class GroundedEntityResponse(BaseModel):
    """Entity response with source grounding information."""

    type: str = Field(..., description="Entity type (person, organization, etc.)")
    value: str = Field(..., description="Entity value as it appears in text")
    normalized_value: str = Field(..., description="Normalized/canonical form")
    confidence: float = Field(..., description="Confidence score (0-1)")
    start_offset: int = Field(..., description="Start character position in source")
    end_offset: int = Field(..., description="End character position in source")
    source_text: str = Field(..., description="Exact source text that was extracted")


class ExtractionResponse(BaseModel):
    """Response body for entity extraction."""

    entities: List[GroundedEntityResponse]
    total_extracted: int
    language: str


@app.post("/extract", response_model=ExtractionResponse, dependencies=[Depends(verify_api_key)])
async def extract(request: ExtractionRequest) -> ExtractionResponse:
    """
    Extract named entities from transcript text.

    Uses LangExtract with Gemini for high-quality extraction with:
    - Source grounding (character offsets)
    - Confidence scores
    - Multi-pass extraction for long documents
    """
    if not request.transcript or not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")

    if len(request.transcript) > MAX_TRANSCRIPT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Transcript too large (max {MAX_TRANSCRIPT_LENGTH} characters)",
        )

    try:
        entities = extract_entities(request.transcript, request.language)

        return ExtractionResponse(
            entities=[
                GroundedEntityResponse(
                    type=e.type,
                    value=e.value,
                    normalized_value=e.normalized_value,
                    confidence=e.confidence,
                    start_offset=e.start_offset,
                    end_offset=e.end_offset,
                    source_text=e.source_text,
                )
                for e in entities
            ],
            total_extracted=len(entities),
            language=request.language,
        )
    except Exception as e:
        print(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.get("/health")
async def health():
    """Health check endpoint."""
    openai_key_configured = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "status": "healthy" if openai_key_configured else "degraded",
        "service": "langextract",
        "model": os.getenv("LANGEXTRACT_MODEL", "gpt-4o-mini"),
        "openai_key_configured": openai_key_configured,
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Tami Entity Extraction Service",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
