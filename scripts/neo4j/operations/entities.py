"""
Entity operations for Tami Knowledge Graph.

Provides CRUD operations for entities in Neo4j.
"""

from typing import List, Optional, Dict, Any
from ..client import get_neo4j_client
from ..models import Entity, EntityType, EntityMention
import uuid


class EntityOperations:
    """CRUD operations for entities in Neo4j."""

    def __init__(self):
        self.client = get_neo4j_client()

    def upsert_entity(self, entity: Entity) -> Optional[Dict]:
        """
        Create or update entity, merging by normalized_value.

        If entity with same user_id, type, and normalized_value exists,
        updates mention_count and last_seen. Otherwise creates new entity.
        """
        label = entity.type.value.capitalize()

        query = f"""
        MERGE (e:Entity:{label} {{
            user_id: $user_id,
            normalized_value: $normalized_value
        }})
        ON CREATE SET
            e.id = $id,
            e.display_value = $display_value,
            e.aliases = $aliases,
            e.description = $description,
            e.mention_count = $mention_count,
            e.confidence = $confidence,
            e.first_seen = datetime($first_seen),
            e.last_seen = datetime($last_seen),
            e.sentiment_avg = $sentiment_avg,
            e.is_user_created = $is_user_created,
            e.created_at = datetime()
        ON MATCH SET
            e.mention_count = e.mention_count + $mention_count,
            e.last_seen = datetime($last_seen),
            e.aliases = CASE
                WHEN size([a IN $aliases WHERE NOT a IN e.aliases]) > 0
                THEN e.aliases + [a IN $aliases WHERE NOT a IN e.aliases]
                ELSE e.aliases
            END,
            e.updated_at = datetime()
        RETURN e
        """

        result = self.client.run_single_query(query, {
            "id": entity.id or str(uuid.uuid4()),
            "user_id": entity.user_id,
            "normalized_value": entity.normalized_value.lower(),
            "display_value": entity.display_value,
            "aliases": entity.aliases,
            "description": entity.description,
            "mention_count": entity.mention_count,
            "confidence": entity.confidence,
            "first_seen": entity.first_seen.isoformat(),
            "last_seen": entity.last_seen.isoformat(),
            "sentiment_avg": entity.sentiment_avg,
            "is_user_created": entity.is_user_created
        })

        return dict(result["e"]) if result else None

    def get_entity(self, entity_id: str, user_id: str) -> Optional[Dict]:
        """Get entity with its mentions and relationships."""
        query = """
        MATCH (e:Entity {id: $entity_id, user_id: $user_id})
        OPTIONAL MATCH (e)-[m:MENTIONED_IN]->(meeting:Meeting)
        OPTIONAL MATCH (e)-[r]->(related:Entity)
        WHERE type(r) <> 'MENTIONED_IN'
        RETURN e,
               collect(DISTINCT {meeting: meeting, mention: properties(m)}) as mentions,
               collect(DISTINCT {entity: related, rel: type(r), props: properties(r)}) as relationships
        """

        result = self.client.run_single_query(query, {
            "entity_id": entity_id,
            "user_id": user_id
        })

        if result:
            return {
                "entity": dict(result["e"]),
                "mentions": result["mentions"],
                "relationships": result["relationships"]
            }
        return None

    def list_entities_by_type(
        self,
        user_id: str,
        entity_type: EntityType,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """List entities of a specific type for a user."""
        label = entity_type.value.capitalize()

        query = f"""
        MATCH (e:Entity:{label} {{user_id: $user_id}})
        OPTIONAL MATCH (e)-[:MENTIONED_IN]->(m:Meeting)
        WITH e, count(DISTINCT m) as meeting_count
        RETURN e, meeting_count
        ORDER BY e.mention_count DESC
        SKIP $offset LIMIT $limit
        """

        results = self.client.run_query(query, {
            "user_id": user_id,
            "offset": offset,
            "limit": limit
        })

        return [
            {"entity": dict(r["e"]), "meeting_count": r["meeting_count"]}
            for r in results
        ]

    def list_all_entities(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, List[Dict]]:
        """List all entities grouped by type."""
        query = """
        MATCH (e:Entity {user_id: $user_id})
        OPTIONAL MATCH (e)-[:MENTIONED_IN]->(m:Meeting)
        WITH e, count(DISTINCT m) as meeting_count, labels(e) as types
        RETURN e, meeting_count, [t IN types WHERE t <> 'Entity'][0] as type
        ORDER BY e.mention_count DESC
        SKIP $offset LIMIT $limit
        """

        results = self.client.run_query(query, {
            "user_id": user_id,
            "offset": offset,
            "limit": limit
        })

        # Group by type
        grouped: Dict[str, List[Dict]] = {}
        for r in results:
            entity_type = r["type"].lower() if r["type"] else "other"
            if entity_type not in grouped:
                grouped[entity_type] = []
            grouped[entity_type].append({
                "entity": dict(r["e"]),
                "meeting_count": r["meeting_count"]
            })

        return grouped

    def search_entities(
        self,
        user_id: str,
        query_text: str,
        types: Optional[List[EntityType]] = None,
        limit: int = 20
    ) -> List[Dict]:
        """Full-text search across entities."""
        type_filter = ""
        if types:
            labels = " OR ".join([f"node:{t.value.capitalize()}" for t in types])
            type_filter = f"AND ({labels})"

        query = f"""
        CALL db.index.fulltext.queryNodes('entity_search', $query_text)
        YIELD node, score
        WHERE node.user_id = $user_id {type_filter}
        RETURN node as e, score, labels(node) as types
        ORDER BY score DESC
        LIMIT $limit
        """

        results = self.client.run_query(query, {
            "user_id": user_id,
            "query_text": query_text,
            "limit": limit
        })

        return [
            {
                "entity": dict(r["e"]),
                "score": r["score"],
                "type": [t for t in r["types"] if t != "Entity"][0].lower()
            }
            for r in results
        ]

    def add_mention(self, mention: EntityMention) -> bool:
        """Link entity to meeting with mention details."""
        query = """
        MATCH (e:Entity {id: $entity_id})
        MATCH (m:Meeting {id: $meeting_id})
        MERGE (e)-[r:MENTIONED_IN]->(m)
        ON CREATE SET
            r.context = $context,
            r.timestamp_start = $timestamp_start,
            r.timestamp_end = $timestamp_end,
            r.speaker = $speaker,
            r.mention_count = $mention_count,
            r.sentiment = $sentiment,
            r.created_at = datetime()
        ON MATCH SET
            r.mention_count = r.mention_count + $mention_count,
            r.updated_at = datetime()
        RETURN r
        """

        result = self.client.run_single_query(query, {
            "entity_id": mention.entity_id,
            "meeting_id": mention.meeting_id,
            "context": mention.context,
            "timestamp_start": mention.timestamp_start,
            "timestamp_end": mention.timestamp_end,
            "speaker": mention.speaker,
            "mention_count": mention.mention_count,
            "sentiment": mention.sentiment
        })

        return result is not None

    def merge_entities(self, user_id: str, keep_id: str, merge_id: str) -> bool:
        """
        Merge two entities, keeping one and transferring all relationships.

        Args:
            user_id: User who owns the entities
            keep_id: ID of entity to keep
            merge_id: ID of entity to merge into keep_id (will be deleted)
        """
        query = """
        MATCH (keep:Entity {id: $keep_id, user_id: $user_id})
        MATCH (merge:Entity {id: $merge_id, user_id: $user_id})

        // Transfer MENTIONED_IN relationships
        WITH keep, merge
        OPTIONAL MATCH (merge)-[r:MENTIONED_IN]->(m:Meeting)
        WITH keep, merge, collect({rel: r, meeting: m}) as mentions
        UNWIND mentions as mention
        WITH keep, merge, mentions, mention
        WHERE mention.rel IS NOT NULL
        MERGE (keep)-[nr:MENTIONED_IN]->(mention.meeting)
        ON CREATE SET nr = properties(mention.rel)
        ON MATCH SET nr.mention_count = nr.mention_count + coalesce(mention.rel.mention_count, 1)

        // Update keep entity
        WITH keep, merge
        SET keep.aliases = keep.aliases + merge.aliases + [merge.normalized_value],
            keep.mention_count = keep.mention_count + merge.mention_count,
            keep.updated_at = datetime()

        // Delete the merged entity and its relationships
        WITH keep, merge
        DETACH DELETE merge

        RETURN keep
        """

        result = self.client.run_single_query(query, {
            "user_id": user_id,
            "keep_id": keep_id,
            "merge_id": merge_id
        })

        return result is not None

    def update_entity(
        self,
        entity_id: str,
        user_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict]:
        """Update entity properties."""
        # Build SET clause dynamically
        set_clauses = []
        params = {"entity_id": entity_id, "user_id": user_id}

        allowed_fields = [
            "display_value", "description", "aliases",
            "confidence", "sentiment_avg"
        ]

        for field in allowed_fields:
            if field in updates:
                set_clauses.append(f"e.{field} = ${field}")
                params[field] = updates[field]

        if not set_clauses:
            return None

        set_clauses.append("e.updated_at = datetime()")
        set_clause = ", ".join(set_clauses)

        query = f"""
        MATCH (e:Entity {{id: $entity_id, user_id: $user_id}})
        SET {set_clause}
        RETURN e
        """

        result = self.client.run_single_query(query, params)
        return dict(result["e"]) if result else None

    def delete_entity(self, entity_id: str, user_id: str) -> bool:
        """Delete an entity and all its relationships."""
        query = """
        MATCH (e:Entity {id: $entity_id, user_id: $user_id})
        DETACH DELETE e
        RETURN count(e) as deleted
        """

        result = self.client.run_single_query(query, {
            "entity_id": entity_id,
            "user_id": user_id
        })

        return result and result["deleted"] > 0

    def get_entity_stats(self, user_id: str) -> Dict[str, int]:
        """Get entity counts by type for a user."""
        query = """
        MATCH (e:Entity {user_id: $user_id})
        WITH labels(e) as types, e
        UNWIND types as type
        WHERE type <> 'Entity'
        RETURN toLower(type) as entity_type, count(e) as count
        ORDER BY count DESC
        """

        results = self.client.run_query(query, {"user_id": user_id})
        return {r["entity_type"]: r["count"] for r in results}
