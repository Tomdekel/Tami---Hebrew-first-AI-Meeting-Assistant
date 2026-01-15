"""
Entity schemas for LangExtract extraction service.
"""

from dataclasses import dataclass
from typing import Literal, Optional

EntityType = Literal[
    "person",
    "organization",
    "project",
    "topic",
    "location",
    "date",
    "product",
    "technology",
]


@dataclass
class Entity:
    """Base entity without grounding."""

    type: EntityType
    value: str
    normalized_value: str
    confidence: float  # 0-1 score from LangExtract


@dataclass
class GroundedEntity(Entity):
    """Entity with source grounding - knows exactly where in the text it came from."""

    start_offset: int  # Character position in source
    end_offset: int
    source_text: str  # Exact text that was extracted
