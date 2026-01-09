"""
Neo4j Client for Tami Knowledge Graph

Setup:
1. pip install neo4j python-dotenv pydantic
2. Set environment variables:
   NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=<password>
3. Run: python -m scripts.neo4j.setup_schema

CLI Tools Installation:
- macOS: brew install cypher-shell
- Linux: apt install cypher-shell (or download from neo4j.com)
- Test: cypher-shell -a $NEO4J_URI -u neo4j -p $NEO4J_PASSWORD "RETURN 1"
"""

from neo4j import GraphDatabase, Driver
from contextlib import contextmanager
from typing import Optional, List, Dict, Any, Generator
import os
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(".env.local")
load_dotenv()


class Neo4jClient:
    """Singleton Neo4j client for Tami knowledge graph operations."""

    _instance: Optional['Neo4jClient'] = None
    _driver: Optional[Driver] = None

    def __new__(cls) -> 'Neo4jClient':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if self._driver is None:
            uri = os.getenv("NEO4J_URI")
            username = os.getenv("NEO4J_USERNAME")
            password = os.getenv("NEO4J_PASSWORD")

            if not all([uri, username, password]):
                raise ValueError(
                    "Missing Neo4j credentials. Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD"
                )

            self._driver = GraphDatabase.driver(
                uri,
                auth=(username, password)
            )

    @contextmanager
    def session(self, database: str = "neo4j") -> Generator:
        """Get a Neo4j session with automatic cleanup."""
        session = self._driver.session(database=database)
        try:
            yield session
        finally:
            session.close()

    def close(self) -> None:
        """Close the driver connection."""
        if self._driver:
            self._driver.close()
            self._driver = None

    def verify_connection(self) -> bool:
        """Verify the Neo4j connection is working."""
        try:
            with self.session() as session:
                result = session.run("RETURN 1 AS test")
                return result.single()["test"] == 1
        except Exception as e:
            print(f"Connection failed: {e}")
            return False

    def run_query(self, query: str, params: Dict[str, Any] = None) -> List[Dict]:
        """Run a Cypher query and return results as list of dicts."""
        with self.session() as session:
            result = session.run(query, params or {})
            return [dict(record) for record in result]

    def run_single_query(self, query: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Run a query expecting a single result."""
        results = self.run_query(query, params)
        return results[0] if results else None


def get_neo4j_client() -> Neo4jClient:
    """Get the singleton Neo4j client instance."""
    return Neo4jClient()


if __name__ == "__main__":
    # Quick connection test
    client = get_neo4j_client()
    if client.verify_connection():
        print("Successfully connected to Neo4j!")

        # Show database info
        result = client.run_single_query("CALL dbms.components() YIELD name, versions RETURN name, versions")
        if result:
            print(f"Database: {result['name']} {result['versions']}")
    else:
        print("Failed to connect to Neo4j")
