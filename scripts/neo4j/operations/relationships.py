"""
Relationship operations for Tami Knowledge Graph.

Provides operations for entity relationships and graph traversals.
"""

from typing import List, Dict, Optional
from ..client import get_neo4j_client
from ..models import EntityRelationship, RelationshipType


class RelationshipOperations:
    """Operations for entity relationships in Neo4j."""

    VALID_RELATIONSHIPS = {
        ("Person", "Organization"): ["WORKS_AT", "FOUNDED", "LEADS"],
        ("Person", "Project"): ["MANAGES", "WORKS_ON", "OWNS"],
        ("Person", "Person"): ["COLLABORATES_WITH", "REPORTS_TO", "MENTORS"],
        ("Person", "ActionItem"): ["ASSIGNED_TO"],
        ("Project", "Technology"): ["USES", "BUILT_WITH"],
        ("Project", "Topic"): ["RELATED_TO", "ADDRESSES"],
        ("Organization", "Location"): ["LOCATED_IN", "OPERATES_IN"],
        ("ActionItem", "Date"): ["SCHEDULED_FOR", "DUE_ON"],
    }

    def __init__(self):
        self.client = get_neo4j_client()

    def create_relationship(self, rel: EntityRelationship) -> bool:
        """Create a relationship between two entities."""
        query = """
        MATCH (from:Entity {id: $from_id})
        MATCH (to:Entity {id: $to_id})
        CALL apoc.create.relationship(from, $rel_type, $properties, to) YIELD rel
        RETURN rel
        """

        try:
            result = self.client.run_single_query(query, {
                "from_id": rel.from_entity_id,
                "to_id": rel.to_entity_id,
                "rel_type": rel.relationship_type.value if hasattr(rel.relationship_type, 'value') else rel.relationship_type,
                "properties": {
                    "confidence": rel.confidence,
                    "source": rel.source,
                    "created_at": "datetime()",
                    **rel.properties
                }
            })
            return result is not None
        except Exception:
            # If APOC is not available, use standard Cypher
            # Note: This requires knowing the relationship type at query time
            rel_type = rel.relationship_type.value if hasattr(rel.relationship_type, 'value') else rel.relationship_type
            fallback_query = f"""
            MATCH (from:Entity {{id: $from_id}})
            MATCH (to:Entity {{id: $to_id}})
            CREATE (from)-[r:{rel_type} {{
                confidence: $confidence,
                source: $source,
                created_at: datetime()
            }}]->(to)
            RETURN r
            """
            result = self.client.run_single_query(fallback_query, {
                "from_id": rel.from_entity_id,
                "to_id": rel.to_entity_id,
                "confidence": rel.confidence,
                "source": rel.source
            })
            return result is not None

    def get_entity_relationships(
        self,
        entity_id: str,
        user_id: str,
        direction: str = "both"
    ) -> List[Dict]:
        """Get all relationships for an entity."""
        if direction == "outgoing":
            query = """
            MATCH (e:Entity {id: $entity_id, user_id: $user_id})-[r]->(target)
            WHERE NOT type(r) = 'MENTIONED_IN'
            RETURN target, type(r) as rel_type, properties(r) as rel_props
            """
        elif direction == "incoming":
            query = """
            MATCH (source)-[r]->(e:Entity {id: $entity_id, user_id: $user_id})
            WHERE NOT type(r) = 'MENTIONED_IN'
            RETURN source as target, type(r) as rel_type, properties(r) as rel_props
            """
        else:
            query = """
            MATCH (e:Entity {id: $entity_id, user_id: $user_id})-[r]-(connected)
            WHERE NOT type(r) = 'MENTIONED_IN'
            RETURN connected as target, type(r) as rel_type, properties(r) as rel_props,
                   CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END as direction
            """

        results = self.client.run_query(query, {
            "entity_id": entity_id,
            "user_id": user_id
        })

        return [
            {
                "entity": dict(r["target"]) if r["target"] else None,
                "relationship_type": r["rel_type"],
                "properties": r["rel_props"],
                "direction": r.get("direction", direction)
            }
            for r in results
        ]

    def get_entity_graph(
        self,
        entity_id: str,
        user_id: str,
        depth: int = 2
    ) -> Dict:
        """Get entity's relationship graph up to N hops."""
        # Try with APOC first, fall back to basic traversal
        try:
            query = """
            MATCH (start:Entity {id: $entity_id, user_id: $user_id})
            CALL apoc.path.subgraphAll(start, {
                maxLevel: $depth,
                relationshipFilter: "MENTIONED_IN|WORKS_AT|MANAGES|COLLABORATES_WITH|USES|RELATED_TO|ASSIGNED_TO"
            }) YIELD nodes, relationships
            RETURN nodes, relationships
            """
            result = self.client.run_single_query(query, {
                "entity_id": entity_id,
                "user_id": user_id,
                "depth": depth
            })

            if result:
                return {
                    "nodes": [dict(n) for n in result["nodes"]],
                    "relationships": [
                        {
                            "from": dict(r.start_node)["id"],
                            "to": dict(r.end_node)["id"],
                            "type": r.type,
                            "properties": dict(r)
                        }
                        for r in result["relationships"]
                    ]
                }
        except Exception:
            pass

        # Fallback: basic traversal without APOC
        query = f"""
        MATCH (start:Entity {{id: $entity_id, user_id: $user_id}})
        OPTIONAL MATCH path = (start)-[*1..{depth}]-(connected)
        WHERE connected:Entity OR connected:Meeting
        WITH start, collect(DISTINCT connected) as connected_nodes,
             collect(DISTINCT relationships(path)) as all_rels
        RETURN start, connected_nodes,
               reduce(rels = [], r IN all_rels | rels + r) as relationships
        """

        result = self.client.run_single_query(query, {
            "entity_id": entity_id,
            "user_id": user_id
        })

        if result:
            nodes = [dict(result["start"])]
            if result["connected_nodes"]:
                nodes.extend([dict(n) for n in result["connected_nodes"] if n])

            edges = []
            if result["relationships"]:
                for r in result["relationships"]:
                    if r:
                        edges.append({
                            "from": dict(r.start_node).get("id"),
                            "to": dict(r.end_node).get("id"),
                            "type": r.type,
                            "properties": dict(r)
                        })

            return {"nodes": nodes, "relationships": edges}

        return {"nodes": [], "relationships": []}

    def find_connections(
        self,
        entity_id_1: str,
        entity_id_2: str,
        user_id: str,
        max_hops: int = 4
    ) -> List[Dict]:
        """Find paths connecting two entities."""
        query = f"""
        MATCH (a:Entity {{id: $id1, user_id: $user_id}})
        MATCH (b:Entity {{id: $id2, user_id: $user_id}})
        MATCH path = shortestPath((a)-[*1..{max_hops}]-(b))
        RETURN [node IN nodes(path) | properties(node)] as path_nodes,
               [rel IN relationships(path) | {{type: type(rel), props: properties(rel)}}] as path_rels
        LIMIT 5
        """

        results = self.client.run_query(query, {
            "id1": entity_id_1,
            "id2": entity_id_2,
            "user_id": user_id
        })

        return [
            {
                "nodes": r["path_nodes"],
                "relationships": r["path_rels"]
            }
            for r in results
        ]

    def get_co_occurrences(
        self,
        user_id: str,
        min_meetings: int = 2,
        limit: int = 50
    ) -> List[Dict]:
        """Find entities that frequently appear together in meetings."""
        query = """
        MATCH (e1:Entity {user_id: $user_id})-[:MENTIONED_IN]->(m:Meeting)<-[:MENTIONED_IN]-(e2:Entity)
        WHERE e1.id < e2.id AND e1.user_id = e2.user_id
        WITH e1, e2, count(DISTINCT m) as shared_meetings, collect(DISTINCT m.title) as meeting_titles
        WHERE shared_meetings >= $min_meetings
        RETURN e1, e2, shared_meetings, meeting_titles
        ORDER BY shared_meetings DESC
        LIMIT $limit
        """

        results = self.client.run_query(query, {
            "user_id": user_id,
            "min_meetings": min_meetings,
            "limit": limit
        })

        return [
            {
                "entity1": dict(r["e1"]),
                "entity2": dict(r["e2"]),
                "shared_meetings": r["shared_meetings"],
                "meeting_titles": r["meeting_titles"]
            }
            for r in results
        ]

    def delete_relationship(
        self,
        from_entity_id: str,
        to_entity_id: str,
        relationship_type: str,
        user_id: str
    ) -> bool:
        """Delete a specific relationship between two entities."""
        query = f"""
        MATCH (from:Entity {{id: $from_id, user_id: $user_id}})
              -[r:{relationship_type}]->
              (to:Entity {{id: $to_id}})
        DELETE r
        RETURN count(r) as deleted
        """

        result = self.client.run_single_query(query, {
            "from_id": from_entity_id,
            "to_id": to_entity_id,
            "user_id": user_id
        })

        return result and result["deleted"] > 0

    def infer_collaborations(self, user_id: str, min_co_occurrences: int = 3) -> int:
        """
        Infer COLLABORATES_WITH relationships from co-occurrence patterns.
        Returns the number of relationships created.
        """
        query = """
        MATCH (p1:Entity:Person {user_id: $user_id})-[:MENTIONED_IN]->(m:Meeting)<-[:MENTIONED_IN]-(p2:Entity:Person)
        WHERE p1.id < p2.id AND p1.user_id = p2.user_id
        WITH p1, p2, count(DISTINCT m) as meeting_count
        WHERE meeting_count >= $min_co_occurrences
        MERGE (p1)-[r:COLLABORATES_WITH]->(p2)
        ON CREATE SET r.strength = meeting_count,
                      r.source = 'inferred',
                      r.created_at = datetime()
        ON MATCH SET r.strength = meeting_count,
                     r.updated_at = datetime()
        RETURN count(r) as created
        """

        result = self.client.run_single_query(query, {
            "user_id": user_id,
            "min_co_occurrences": min_co_occurrences
        })

        return result["created"] if result else 0
