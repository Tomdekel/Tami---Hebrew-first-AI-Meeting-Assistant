
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// DELETE /api/entities/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. Delete from Neo4j (Sync)
        try {
            const { runQuery } = await import("@/lib/neo4j/client");
            await runQuery(
                `
        MATCH (e:Entity {id: $id})
        DETACH DELETE e
        `,
                { id }
            );
        } catch (graphError) {
            console.error("Failed to delete entity from Graph:", graphError);
        }

        // 2. Delete from Postgres
        const { error } = await supabase
            .from("entities")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete entity error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// PATCH /api/entities/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, type } = body; // Expect 'name' as new value

        if (!name && !type) {
            return NextResponse.json({ error: "No changes provided" }, { status: 400 });
        }

        const updates: any = {};
        if (name) {
            updates.value = name; // 'value' is the column name in Postgres
            updates.normalized_value = name.toLowerCase().trim();
        }
        if (type) updates.type = type;

        // 1. Update Postgres
        const { data: updatedEntity, error } = await supabase
            .from("entities")
            .update(updates)
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 2. Update Neo4j
        try {
            const { runQuery } = await import("@/lib/neo4j/client");
            // Build dynamic cypher set
            let cypher = `MATCH (e:Entity {id: $id}) SET `;
            const sets = [];
            const cypherParams: any = { id };

            if (name) {
                sets.push("e.display_value = $name");
                sets.push("e.normalized_value = $normalizedValue");
                cypherParams.name = name;
                cypherParams.normalizedValue = name.toLowerCase().trim();
            }
            if (type) {
                // In Neo4j, the label might also need to change if we use labels for types
                // But the 'type' property is also maintained
                sets.push("e.type = $type");
                cypherParams.type = type;
            }

            if (sets.length > 0) {
                cypher += sets.join(", ");
                await runQuery(cypher, cypherParams);
            }
        } catch (graphError) {
            console.error("Failed to update entity in Graph:", graphError);
        }

        return NextResponse.json({ entity: updatedEntity });
    } catch (error) {
        console.error("Update entity error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
