"""
Migrate data from Supabase PostgreSQL to Neo4j.

This script exports data from the current relational database
and imports it into the Neo4j knowledge graph.

Usage:
    python -m scripts.neo4j.migrate_data --dry-run  # Preview changes
    python -m scripts.neo4j.migrate_data            # Execute migration
"""

import argparse
import os
from datetime import datetime
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv()

# Import after loading env
from supabase import create_client, Client
from .client import get_neo4j_client


def get_supabase_client() -> Client:
    """Create Supabase client."""
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise ValueError("Missing Supabase credentials")

    return create_client(url, key)


def migrate_meetings(supabase: Client, neo4j_session, dry_run: bool) -> int:
    """Migrate sessions to Meeting nodes."""
    print("\nMigrating meetings...")

    response = supabase.table("sessions").select("*").execute()
    sessions = response.data

    count = 0
    for s in sessions:
        if dry_run:
            print(f"  Would create Meeting: {s['title']}")
            count += 1
            continue

        neo4j_session.run("""
            MERGE (m:Meeting {id: $id})
            SET m.user_id = $user_id,
                m.title = $title,
                m.status = $status,
                m.audio_url = $audio_url,
                m.duration_seconds = $duration_seconds,
                m.detected_language = $detected_language,
                m.created_at = datetime($created_at)
        """, {
            "id": s["id"],
            "user_id": s["user_id"],
            "title": s["title"] or "Untitled Meeting",
            "status": s["status"],
            "audio_url": s.get("audio_url"),
            "duration_seconds": s.get("duration_seconds"),
            "detected_language": s.get("detected_language"),
            "created_at": s["created_at"]
        })
        count += 1

    print(f"  Migrated {count} meetings")
    return count


def migrate_entities(supabase: Client, neo4j_session, dry_run: bool) -> int:
    """Migrate entities with type-specific labels."""
    print("\nMigrating entities...")

    response = supabase.table("entities").select("*").execute()
    entities = response.data

    count = 0
    for e in entities:
        label = e["type"].capitalize()

        if dry_run:
            print(f"  Would create Entity:{label}: {e['value']}")
            count += 1
            continue

        # Use dynamic label
        neo4j_session.run(f"""
            MERGE (e:Entity:{label} {{
                user_id: $user_id,
                normalized_value: $normalized_value
            }})
            ON CREATE SET
                e.id = $id,
                e.display_value = $value,
                e.mention_count = $mention_count,
                e.aliases = [],
                e.first_seen = datetime($created_at),
                e.last_seen = datetime($updated_at),
                e.created_at = datetime($created_at)
            ON MATCH SET
                e.mention_count = e.mention_count + $mention_count
        """, {
            "id": e["id"],
            "user_id": e["user_id"],
            "normalized_value": e["normalized_value"],
            "value": e["value"],
            "mention_count": e["mention_count"],
            "created_at": e["created_at"],
            "updated_at": e.get("updated_at") or e["created_at"]
        })
        count += 1

    print(f"  Migrated {count} entities")
    return count


def migrate_entity_mentions(supabase: Client, neo4j_session, dry_run: bool) -> int:
    """Migrate entity_mentions as MENTIONED_IN relationships."""
    print("\nMigrating entity mentions...")

    response = supabase.table("entity_mentions").select("*").execute()
    mentions = response.data

    count = 0
    errors = 0
    for m in mentions:
        if dry_run:
            print(f"  Would create MENTIONED_IN: {m['entity_id'][:8]}... -> {m['session_id'][:8]}...")
            count += 1
            continue

        try:
            neo4j_session.run("""
                MATCH (e:Entity {id: $entity_id})
                MATCH (meeting:Meeting {id: $session_id})
                MERGE (e)-[r:MENTIONED_IN]->(meeting)
                ON CREATE SET
                    r.context = $context,
                    r.mention_count = 1,
                    r.created_at = datetime($created_at)
                ON MATCH SET
                    r.mention_count = r.mention_count + 1
            """, {
                "entity_id": m["entity_id"],
                "session_id": m["session_id"],
                "context": m.get("context"),
                "created_at": m["created_at"]
            })
            count += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"  Warning: Could not create mention - {e}")

    if errors > 3:
        print(f"  ... and {errors - 3} more errors")

    print(f"  Migrated {count} mentions ({errors} errors)")
    return count


def migrate_action_items(supabase: Client, neo4j_session, dry_run: bool) -> int:
    """Migrate action items and link to meetings/people."""
    print("\nMigrating action items...")

    # Get action items via summaries
    response = supabase.table("summaries").select("session_id, action_items(*)").execute()
    summaries = response.data

    count = 0
    for summary in summaries:
        session_id = summary.get("session_id")
        items = summary.get("action_items", [])

        if not items:
            continue

        for item in items:
            if dry_run:
                desc = item['description'][:50] if item.get('description') else 'No description'
                print(f"  Would create ActionItem: {desc}...")
                count += 1
                continue

            # Get user_id from the session
            session_response = supabase.table("sessions").select("user_id").eq("id", session_id).single().execute()
            user_id = session_response.data.get("user_id") if session_response.data else None

            if not user_id:
                continue

            neo4j_session.run("""
                MERGE (a:ActionItem {id: $id})
                SET a.user_id = $user_id,
                    a.description = $description,
                    a.status = $status,
                    a.assignee = $assignee,
                    a.due_date = $due_date,
                    a.created_at = datetime($created_at)

                WITH a
                MATCH (m:Meeting {id: $meeting_id})
                MERGE (a)-[:CREATED_IN]->(m)
            """, {
                "id": item["id"],
                "user_id": user_id,
                "description": item.get("description", ""),
                "status": "completed" if item.get("completed") else "pending",
                "assignee": item.get("assignee"),
                "due_date": item.get("deadline"),
                "meeting_id": session_id,
                "created_at": item["created_at"]
            })

            # Try to link to assignee entity if exists
            if item.get("assignee"):
                try:
                    neo4j_session.run("""
                        MATCH (a:ActionItem {id: $item_id})
                        MATCH (p:Entity:Person)
                        WHERE toLower(p.normalized_value) = toLower($assignee)
                           OR toLower(p.display_value) = toLower($assignee)
                        WITH a, p LIMIT 1
                        MERGE (p)-[:ASSIGNED_TO]->(a)
                    """, {
                        "item_id": item["id"],
                        "assignee": item["assignee"]
                    })
                except Exception:
                    pass  # Assignee entity may not exist

            count += 1

    print(f"  Migrated {count} action items")
    return count


def verify_migration(neo4j_session) -> None:
    """Verify migration by counting nodes and relationships."""
    print("\n" + "=" * 50)
    print("Migration Verification")
    print("=" * 50)

    # Count nodes by label
    result = neo4j_session.run("""
        MATCH (n)
        RETURN labels(n)[0] as label, count(n) as count
        ORDER BY count DESC
    """)

    print("\nNode counts:")
    for record in result:
        print(f"  {record['label']}: {record['count']}")

    # Count relationships
    result = neo4j_session.run("""
        MATCH ()-[r]->()
        RETURN type(r) as type, count(r) as count
        ORDER BY count DESC
    """)

    print("\nRelationship counts:")
    for record in result:
        print(f"  {record['type']}: {record['count']}")


def main():
    parser = argparse.ArgumentParser(description="Migrate Supabase data to Neo4j")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without making them"
    )
    parser.add_argument(
        "--skip-meetings",
        action="store_true",
        help="Skip migrating meetings"
    )
    parser.add_argument(
        "--skip-entities",
        action="store_true",
        help="Skip migrating entities"
    )
    parser.add_argument(
        "--skip-mentions",
        action="store_true",
        help="Skip migrating entity mentions"
    )
    parser.add_argument(
        "--skip-action-items",
        action="store_true",
        help="Skip migrating action items"
    )
    args = parser.parse_args()

    print("=" * 50)
    print("Tami Data Migration: Supabase -> Neo4j")
    print("=" * 50)

    if args.dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***\n")

    # Initialize clients
    try:
        supabase = get_supabase_client()
        print("Connected to Supabase")
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        return

    neo4j = get_neo4j_client()
    if not neo4j.verify_connection():
        print("Failed to connect to Neo4j")
        return
    print("Connected to Neo4j")

    # Run migration
    with neo4j.session() as session:
        total = 0

        if not args.skip_meetings:
            total += migrate_meetings(supabase, session, args.dry_run)

        if not args.skip_entities:
            total += migrate_entities(supabase, session, args.dry_run)

        if not args.skip_mentions:
            total += migrate_entity_mentions(supabase, session, args.dry_run)

        if not args.skip_action_items:
            total += migrate_action_items(supabase, session, args.dry_run)

        print(f"\nTotal items processed: {total}")

        if not args.dry_run:
            verify_migration(session)

    print("\n" + "=" * 50)
    if args.dry_run:
        print("Dry run complete. Run without --dry-run to execute.")
    else:
        print("Migration complete!")
    print("=" * 50)


if __name__ == "__main__":
    main()
