"""
LangExtract-based entity extraction with source grounding.

Uses Google's LangExtract library for high-quality entity extraction
with precise character-level source grounding.
"""

import os
from typing import List

import langextract as lx
from langextract import data as lx_data
from dotenv import load_dotenv

from schemas import GroundedEntity

load_dotenv()


def build_examples() -> List[lx_data.ExampleData]:
    """Build LangExtract ExampleData objects for few-shot learning.

    Note: LangExtract doesn't support empty extractions (negative examples),
    so we rely on the prompt description to specify what NOT to extract.
    """
    return [
        # Example with person, organization, project, location
        lx_data.ExampleData(
            text="Meeting with דני כהן from Anthropic about the Claude project in Tel Aviv",
            extractions=[
                lx_data.Extraction(
                    extraction_class="person",
                    extraction_text="דני כהן",
                    attributes={"normalized_value": "דני כהן"},
                ),
                lx_data.Extraction(
                    extraction_class="organization",
                    extraction_text="Anthropic",
                    attributes={"normalized_value": "anthropic"},
                ),
                lx_data.Extraction(
                    extraction_class="project",
                    extraction_text="Claude",
                    attributes={"normalized_value": "claude"},
                ),
                lx_data.Extraction(
                    extraction_class="location",
                    extraction_text="Tel Aviv",
                    attributes={"normalized_value": "tel aviv"},
                ),
            ],
        ),
        # Example with technology entities
        lx_data.ExampleData(
            text="We discussed implementing the feature using React and TypeScript with PostgreSQL",
            extractions=[
                lx_data.Extraction(
                    extraction_class="technology",
                    extraction_text="React",
                    attributes={"normalized_value": "react"},
                ),
                lx_data.Extraction(
                    extraction_class="technology",
                    extraction_text="TypeScript",
                    attributes={"normalized_value": "typescript"},
                ),
                lx_data.Extraction(
                    extraction_class="technology",
                    extraction_text="PostgreSQL",
                    attributes={"normalized_value": "postgresql"},
                ),
            ],
        ),
        # Example with speaker label context (shows only extracting real entities)
        lx_data.ExampleData(
            text="Speaker 2: John mentioned that Google is launching a new AI product on January 15th",
            extractions=[
                lx_data.Extraction(
                    extraction_class="person",
                    extraction_text="John",
                    attributes={"normalized_value": "john"},
                ),
                lx_data.Extraction(
                    extraction_class="organization",
                    extraction_text="Google",
                    attributes={"normalized_value": "google"},
                ),
                lx_data.Extraction(
                    extraction_class="date",
                    extraction_text="January 15th",
                    attributes={"normalized_value": "january 15"},
                ),
            ],
        ),
    ]

EXTRACTION_PROMPT = """
Extract named entities from this meeting transcript.

EXTRACT these entity types:
- person: Real people's names (NOT speaker labels like "Speaker 1", "דובר 2")
- organization: Companies, teams, departments with specific names
- project: Specific project or initiative names
- topic: Major topics discussed in depth (not passing mentions)
- location: Specific geographic places
- date: Specific dates ONLY (NOT durations like "a week", "few days", "חמש שעות")
- product: Specific product names
- technology: Technologies, tools, programming languages, frameworks

DO NOT EXTRACT:
- Speaker labels (Speaker 1, Speaker 2, דובר 1, דובר 2)
- Relationships or roles (my wife, the manager, his friend, אשתי, החבר)
- Time durations (week, month, few days, hours, שבוע, חודש, שעות)
- Generic references (the company, the product, the project, החברה, המוצר)
- Entities mentioned only in passing without significance

NORMALIZATION RULES:
- Unify name variants: "Dan"/"Danny"/"Daniel" → pick the most complete form
- Unify location variants: "Tel Aviv"/"Tel Aviv, Israel" → use shorter form
- If an entity could be multiple types, pick the PRIMARY type it's used as
- Lowercase the normalized_value

Return ONLY high-quality, significant entities central to the discussion.
"""


def extract_entities(transcript: str, language: str = "en") -> List[GroundedEntity]:
    """
    Extract entities with source grounding using LangExtract.

    Args:
        transcript: The meeting transcript text
        language: Language code ("en" or "he")

    Returns:
        List of GroundedEntity objects with character offsets
    """
    # Configure model based on environment - use OpenAI gpt-4o-mini by default
    model_id = os.getenv("LANGEXTRACT_MODEL", "gpt-4o-mini")
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("Warning: OPENAI_API_KEY not set")
        return []

    try:
        examples = build_examples()
        result = lx.extract(
            text_or_documents=transcript,
            prompt_description=EXTRACTION_PROMPT,
            examples=examples,
            model_id=model_id,
            api_key=api_key,
            fence_output=True,  # Required for OpenAI models
            use_schema_constraints=False,  # OpenAI doesn't support schema constraints
        )
    except Exception as e:
        print(f"LangExtract error: {e}")
        return []

    entities = []
    for extraction in result.extractions:
        try:
            # Access LangExtract's actual attribute names
            entity_type = extraction.extraction_class or "topic"
            entity_value = extraction.extraction_text or ""
            attributes = extraction.attributes or {}
            normalized = attributes.get("normalized_value", entity_value).lower()

            # Get character positions if available
            start_offset = 0
            end_offset = 0
            if extraction.char_interval:
                start_offset = extraction.char_interval.start_pos
                end_offset = extraction.char_interval.end_pos

            # Confidence based on alignment status (if available)
            confidence = 0.8
            if hasattr(extraction, "alignment_status"):
                # Perfect alignment = high confidence
                if str(extraction.alignment_status) == "EXACT":
                    confidence = 1.0
                elif str(extraction.alignment_status) == "APPROXIMATE":
                    confidence = 0.85

            entities.append(
                GroundedEntity(
                    type=entity_type,
                    value=entity_value,
                    normalized_value=normalized,
                    confidence=confidence,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    source_text=entity_value,
                )
            )
        except Exception as e:
            print(f"Error processing extraction: {e}")
            continue

    # Filter low-confidence extractions (threshold: 0.7)
    min_confidence = float(os.getenv("MIN_CONFIDENCE", "0.7"))
    filtered = [e for e in entities if e.confidence >= min_confidence]

    print(f"Extracted {len(entities)} entities, {len(filtered)} passed confidence filter")
    return filtered
