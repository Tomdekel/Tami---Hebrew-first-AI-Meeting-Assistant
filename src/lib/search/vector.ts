
import { SupabaseClient } from "@supabase/supabase-js";

export interface VectorSearchResult {
    id: string;
    session_id: string;
    content: string;
    metadata: any;
    similarity: number;
}

interface SearchOptions {
    match_threshold?: number;
    match_count?: number;
    session_id?: string | null;
}

export async function searchEmbeddings(
    supabase: SupabaseClient,
    embedding: number[],
    options: SearchOptions = {}
): Promise<VectorSearchResult[]> {
    const { match_threshold = 0.5, match_count = 10, session_id = null } = options;

    const { data, error } = await supabase.rpc("match_embeddings", {
        query_embedding: embedding,
        match_threshold,
        match_count,
        p_session_id: session_id,
    });

    if (error) {
        console.error("Vector search failed:", error);
        return [];
    }

    return data || [];
}
