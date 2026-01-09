"""
Setup Neo4j schema for Tami Knowledge Graph.

This script creates the necessary constraints, indexes, and initializes
the graph database structure.

Usage:
    python -m scripts.neo4j.setup_schema
"""

from .client import get_neo4j_client


# Schema definition queries
SCHEMA_QUERIES = [
    # ===== Constraints =====
    # Unique ID constraints
    "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
    "CREATE CONSTRAINT meeting_id IF NOT EXISTS FOR (m:Meeting) REQUIRE m.id IS UNIQUE",
    "CREATE CONSTRAINT action_item_id IF NOT EXISTS FOR (a:ActionItem) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT decision_id IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE",
    "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    "CREATE CONSTRAINT entity_type_id IF NOT EXISTS FOR (et:EntityType) REQUIRE et.id IS UNIQUE",

    # ===== Performance Indexes =====
    # Entity indexes
    "CREATE INDEX entity_user_idx IF NOT EXISTS FOR (e:Entity) ON (e.user_id)",
    "CREATE INDEX entity_normalized_idx IF NOT EXISTS FOR (e:Entity) ON (e.normalized_value)",
    "CREATE INDEX entity_type_user_idx IF NOT EXISTS FOR (e:Entity) ON (e.user_id, e.normalized_value)",
    "CREATE INDEX entity_mention_count_idx IF NOT EXISTS FOR (e:Entity) ON (e.mention_count)",

    # Meeting indexes
    "CREATE INDEX meeting_user_idx IF NOT EXISTS FOR (m:Meeting) ON (m.user_id)",
    "CREATE INDEX meeting_created_idx IF NOT EXISTS FOR (m:Meeting) ON (m.created_at)",
    "CREATE INDEX meeting_status_idx IF NOT EXISTS FOR (m:Meeting) ON (m.status)",

    # Action item indexes
    "CREATE INDEX action_item_user_idx IF NOT EXISTS FOR (a:ActionItem) ON (a.user_id)",
    "CREATE INDEX action_item_status_idx IF NOT EXISTS FOR (a:ActionItem) ON (a.status)",

    # Custom entity type indexes
    "CREATE INDEX entity_type_user_idx IF NOT EXISTS FOR (et:EntityType) ON (et.user_id)",
]

# Full-text search indexes (run separately as they have different syntax)
FULLTEXT_INDEXES = [
    # Entity search - search across normalized_value, display_value, and description
    """
    CREATE FULLTEXT INDEX entity_search IF NOT EXISTS
    FOR (e:Entity)
    ON EACH [e.normalized_value, e.display_value, e.description]
    """,

    # Meeting search
    """
    CREATE FULLTEXT INDEX meeting_search IF NOT EXISTS
    FOR (m:Meeting)
    ON EACH [m.title]
    """,

    # Action item search
    """
    CREATE FULLTEXT INDEX action_item_search IF NOT EXISTS
    FOR (a:ActionItem)
    ON EACH [a.description]
    """,
]


def setup_schema() -> None:
    """Create all schema elements in Neo4j."""
    client = get_neo4j_client()

    print("Setting up Neo4j schema for Tami Knowledge Graph...")
    print("-" * 50)

    # Verify connection first
    if not client.verify_connection():
        print("ERROR: Could not connect to Neo4j. Check your credentials.")
        return

    print("Connected to Neo4j successfully!")
    print()

    # Run constraint and index queries
    print("Creating constraints and indexes...")
    for query in SCHEMA_QUERIES:
        try:
            client.run_query(query)
            # Extract constraint/index name from query for logging
            if "CONSTRAINT" in query:
                name = query.split("CONSTRAINT")[1].split("IF")[0].strip()
                print(f"  Constraint: {name}")
            elif "INDEX" in query:
                name = query.split("INDEX")[1].split("IF")[0].strip()
                print(f"  Index: {name}")
        except Exception as e:
            print(f"  Warning: {e}")

    print()

    # Run full-text index queries
    print("Creating full-text search indexes...")
    for query in FULLTEXT_INDEXES:
        try:
            client.run_query(query)
            name = query.split("INDEX")[1].split("IF")[0].strip()
            print(f"  Full-text index: {name}")
        except Exception as e:
            print(f"  Warning: {e}")

    print()
    print("-" * 50)
    print("Schema setup complete!")

    # Show current schema
    print()
    print("Current indexes:")
    indexes = client.run_query("SHOW INDEXES")
    for idx in indexes:
        print(f"  - {idx.get('name', 'unnamed')}: {idx.get('type', 'unknown')} on {idx.get('labelsOrTypes', [])}")

    print()
    print("Current constraints:")
    constraints = client.run_query("SHOW CONSTRAINTS")
    for constraint in constraints:
        print(f"  - {constraint.get('name', 'unnamed')}: {constraint.get('type', 'unknown')}")


def drop_all_schema() -> None:
    """Drop all schema elements (use with caution!)."""
    client = get_neo4j_client()

    print("WARNING: Dropping all schema elements...")

    # Drop all indexes
    indexes = client.run_query("SHOW INDEXES")
    for idx in indexes:
        name = idx.get('name')
        if name:
            try:
                client.run_query(f"DROP INDEX {name}")
                print(f"  Dropped index: {name}")
            except Exception as e:
                print(f"  Could not drop {name}: {e}")

    # Drop all constraints
    constraints = client.run_query("SHOW CONSTRAINTS")
    for constraint in constraints:
        name = constraint.get('name')
        if name:
            try:
                client.run_query(f"DROP CONSTRAINT {name}")
                print(f"  Dropped constraint: {name}")
            except Exception as e:
                print(f"  Could not drop {name}: {e}")


if __name__ == "__main__":
    setup_schema()
