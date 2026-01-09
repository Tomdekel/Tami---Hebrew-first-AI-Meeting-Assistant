/**
 * Neo4j TypeScript Client for Tami Knowledge Graph
 *
 * Provides a simple interface for querying the Neo4j graph database
 * from Next.js API routes.
 */

import neo4j, { Driver, Session, Record as Neo4jRecord } from "neo4j-driver";

let driver: Driver | null = null;

/**
 * Get the Neo4j driver instance (singleton)
 */
export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      throw new Error(
        "Missing Neo4j credentials. Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD"
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }
  return driver;
}

/**
 * Get a Neo4j session
 */
export function getSession(database: string = "neo4j"): Session {
  return getNeo4jDriver().session({ database });
}

/**
 * Run a Cypher query and return results as array of objects
 */
export async function runQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = getSession();

  try {
    const result = await session.run(query, params);
    return result.records.map((record: Neo4jRecord) => {
      const obj: Record<string, unknown> = {};
      record.keys.forEach((key) => {
        const value = record.get(key);
        obj[key as string] = convertNeo4jValue(value);
      });
      return obj as T;
    });
  } finally {
    await session.close();
  }
}

/**
 * Run a query expecting a single result
 */
export async function runSingleQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const results = await runQuery<T>(query, params);
  return results[0] ?? null;
}

/**
 * Convert Neo4j values to plain JavaScript objects
 */
function convertNeo4jValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle Neo4j Node
  if (typeof value === "object" && "properties" in value && "labels" in value) {
    const node = value as { properties: Record<string, unknown>; labels: string[] };
    return {
      ...convertNeo4jProperties(node.properties),
      _labels: node.labels,
    };
  }

  // Handle Neo4j Relationship
  if (typeof value === "object" && "properties" in value && "type" in value) {
    const rel = value as { properties: Record<string, unknown>; type: string };
    return {
      ...convertNeo4jProperties(rel.properties),
      _type: rel.type,
    };
  }

  // Handle Neo4j Integer
  if (neo4j.isInt(value)) {
    return neo4j.integer.toNumber(value);
  }

  // Handle Neo4j DateTime
  if (typeof value === "object" && "year" in value && "month" in value && "day" in value) {
    const dt = value as {
      year: { low: number };
      month: { low: number };
      day: { low: number };
      hour?: { low: number };
      minute?: { low: number };
      second?: { low: number };
    };
    const year = neo4j.isInt(dt.year) ? neo4j.integer.toNumber(dt.year) : dt.year;
    const month = neo4j.isInt(dt.month) ? neo4j.integer.toNumber(dt.month) : dt.month;
    const day = neo4j.isInt(dt.day) ? neo4j.integer.toNumber(dt.day) : dt.day;
    const hour = dt.hour ? (neo4j.isInt(dt.hour) ? neo4j.integer.toNumber(dt.hour) : dt.hour) : 0;
    const minute = dt.minute ? (neo4j.isInt(dt.minute) ? neo4j.integer.toNumber(dt.minute) : dt.minute) : 0;
    const second = dt.second ? (neo4j.isInt(dt.second) ? neo4j.integer.toNumber(dt.second) : dt.second) : 0;

    return new Date(
      year as number,
      (month as number) - 1,
      day as number,
      hour as number,
      minute as number,
      second as number
    ).toISOString();
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(convertNeo4jValue);
  }

  // Handle plain objects
  if (typeof value === "object") {
    return convertNeo4jProperties(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Convert Neo4j properties object
 */
function convertNeo4jProperties(
  props: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    result[key] = convertNeo4jValue(value);
  }
  return result;
}

/**
 * Close the Neo4j driver connection
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Verify Neo4j connection
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const result = await runSingleQuery<{ test: number }>(
      "RETURN 1 AS test"
    );
    return result?.test === 1;
  } catch {
    return false;
  }
}
