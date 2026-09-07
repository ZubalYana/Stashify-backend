import pool from "./index";
import type { Pool, PoolClient } from "pg";

export const SNIPPET_WITH_RELATIONS_SQL = `
SELECT snippets.*,
  (SELECT ARRAY_AGG(t.name)
   FROM snippet_tags st
   JOIN tags t ON t.id = st.tag_id
   WHERE st.snippet_id = snippets.id) as tags,
  COALESCE(
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name) ORDER BY c.name)
     FROM snippet_collections sc
     JOIN collections c ON c.id = sc.collection_id
     WHERE sc.snippet_id = snippets.id),
    '[]'::json
  ) as collections
FROM snippets
`;

export async function fetchSnippetWithRelations(
  id: number,
  client: Pool | PoolClient = pool
) {
  const result = await client.query(
    `${SNIPPET_WITH_RELATIONS_SQL} WHERE snippets.id = $1`,
    [id]
  );
  return result.rows[0];
}
