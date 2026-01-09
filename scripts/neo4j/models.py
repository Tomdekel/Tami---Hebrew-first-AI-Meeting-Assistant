"""
Pydantic models for Tami Knowledge Graph entities.

These models define the structure of nodes and relationships
in the Neo4j graph database.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EntityType(str, Enum):
    """Standard entity types extracted from meeting transcripts."""
    PERSON = "person"
    ORGANIZATION = "organization"
    PROJECT = "project"
    TOPIC = "topic"
    TECHNOLOGY = "technology"
    PRODUCT = "product"
    LOCATION = "location"
    DATE = "date"
    OTHER = "other"


class RelationshipType(str, Enum):
    """Types of relationships between entities."""
    # Entity to Meeting
    MENTIONED_IN = "MENTIONED_IN"

    # Person relationships
    WORKS_AT = "WORKS_AT"
    MANAGES = "MANAGES"
    COLLABORATES_WITH = "COLLABORATES_WITH"
    ASSIGNED_TO = "ASSIGNED_TO"
    REPORTS_TO = "REPORTS_TO"

    # Project relationships
    USES = "USES"
    RELATED_TO = "RELATED_TO"
    DEPENDS_ON = "DEPENDS_ON"

    # Location relationships
    LOCATED_IN = "LOCATED_IN"

    # Time relationships
    SCHEDULED_FOR = "SCHEDULED_FOR"

    # Action items
    CREATED_IN = "CREATED_IN"


class Entity(BaseModel):
    """A knowledge graph entity (node)."""
    id: str
    user_id: str
    type: EntityType
    normalized_value: str  # Lowercase, cleaned for matching
    display_value: str     # Original display format
    aliases: List[str] = Field(default_factory=list)  # Alternative names
    description: Optional[str] = None
    mention_count: int = 1
    confidence: float = 1.0
    first_seen: datetime
    last_seen: datetime
    sentiment_avg: Optional[float] = None
    is_user_created: bool = False

    class Config:
        use_enum_values = True


class EntityMention(BaseModel):
    """A mention of an entity in a specific meeting."""
    entity_id: str
    meeting_id: str
    context: str  # Text snippet where mentioned
    timestamp_start: Optional[float] = None  # Audio timestamp
    timestamp_end: Optional[float] = None
    speaker: Optional[str] = None
    mention_count: int = 1
    sentiment: Optional[float] = None


class EntityRelationship(BaseModel):
    """A relationship between two entities."""
    from_entity_id: str
    to_entity_id: str
    relationship_type: RelationshipType
    confidence: float = 1.0
    source: str = "ai"  # "ai", "user", "inferred"
    properties: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        use_enum_values = True


class Meeting(BaseModel):
    """A meeting/session node in the graph."""
    id: str
    user_id: str
    title: str
    status: str  # pending, processing, completed
    audio_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    detected_language: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime


class ActionItem(BaseModel):
    """An action item extracted from a meeting."""
    id: str
    user_id: str
    meeting_id: str
    description: str
    status: str = "pending"  # pending, in_progress, completed
    assignee_id: Optional[str] = None  # Person entity ID
    due_date: Optional[datetime] = None
    priority: str = "medium"  # low, medium, high


class Decision(BaseModel):
    """A decision made in a meeting."""
    id: str
    user_id: str
    meeting_id: str
    description: str
    context: Optional[str] = None
    created_at: datetime


class CustomEntityType(BaseModel):
    """User-defined entity type."""
    id: str
    user_id: str
    name: str           # Hebrew name (e.g., "מותגים")
    name_en: str        # English name for label (e.g., "brands")
    color: str          # Hex color (e.g., "#FF69B4")
    icon: str           # Icon name (e.g., "tag")
    description: Optional[str] = None
    examples: List[str] = Field(default_factory=list)
    created_at: datetime


class GraphNode(BaseModel):
    """Generic node for graph visualization."""
    id: str
    label: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """Generic edge for graph visualization."""
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphData(BaseModel):
    """Graph data for visualization."""
    nodes: List[GraphNode]
    edges: List[GraphEdge]
