import pool from "../db";
import type { Request, Response } from "express";
import geminiAlalysis from "../AI/gemini";
import type { SnippetAnalysis } from "../types";
import {
  SNIPPET_WITH_RELATIONS_SQL,
  fetchSnippetWithRelations,
} from "../db/snippetSelect";

export async function createSnippet(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      title,
      description,
      code,
      language,
      tags,
      user_id,
      project_id,
      collection_ids,
    } = req.body;
    if (!title || !description || !code || !language || !tags || !user_id) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: "Missed required credentials" });
      return;
    }

    if (collection_ids !== undefined && !Array.isArray(collection_ids)) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: "collection_ids must be an array" });
      return;
    }

    if (project_id != null) {
      const project = await client.query(
        `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
        [project_id, user_id]
      );
      if (project.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ message: "Project not found" });
        return;
      }
    }

    const result = await client.query(
      `INSERT INTO snippets (title, description, code, language, user_id, project_id)
      VALUES($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [title, description, code, language, user_id, project_id ?? null]
    );
    const snippet_id = result.rows[0].id;

    for (const tag of tags as string[]) {
      const result = await client.query(
        `INSERT INTO tags (name)
        VALUES($1)
        ON CONFLICT (name) DO NOTHING
        RETURNING *`,
        [tag]
      );
      let tag_id = result.rows[0]?.id;

      if (!tag_id) {
        const existing = await client.query(
          `SELECT id FROM tags WHERE name = $1`,
          [tag]
        );
        tag_id = existing.rows[0].id;
      }

      await client.query(
        `
        INSERT INTO snippet_tags (snippet_id, tag_id) VALUES ($1, $2)`,
        [snippet_id, tag_id]
      );
    }

    if (Array.isArray(collection_ids) && collection_ids.length > 0) {
      const uniqueIds = [...new Set(collection_ids.map(Number))];
      const owned = await client.query(
        `SELECT id FROM collections WHERE user_id = $1 AND id = ANY($2::int[])`,
        [user_id, uniqueIds]
      );
      if (owned.rows.length !== uniqueIds.length) {
        await client.query("ROLLBACK");
        res.status(404).json({ message: "Collection not found" });
        return;
      }
      for (const collectionId of uniqueIds) {
        await client.query(
          `INSERT INTO snippet_collections (snippet_id, collection_id)
           VALUES ($1, $2)`,
          [snippet_id, collectionId]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      snippet: await fetchSnippetWithRelations(snippet_id, client),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  } finally {
    client.release();
  }
}

export async function getSnippets(req: Request, res: Response) {
  try {
    const { user_id, project_id, collection_id, unfiled, uncollected } =
      req.query;
    const rawSearch = req.query.q ?? req.query.search ?? req.query.searchParams;
    const search =
      typeof rawSearch === "string" && rawSearch.trim() !== ""
        ? rawSearch.trim()
        : null;
    const unfiledOnly = unfiled === "true" || unfiled === "1";
    const uncollectedOnly = uncollected === "true" || uncollected === "1";
    const projectId =
      typeof project_id === "string" && project_id.trim() !== ""
        ? Number(project_id)
        : null;
    const collectionId =
      typeof collection_id === "string" && collection_id.trim() !== ""
        ? Number(collection_id)
        : null;

    if (unfiledOnly && projectId !== null) {
      res.status(400).json({
        message: "Use either project_id or unfiled, not both",
      });
      return;
    }

    if (uncollectedOnly && collectionId !== null) {
      res.status(400).json({
        message: "Use either collection_id or uncollected, not both",
      });
      return;
    }

    const snippets = await pool.query(
      `${SNIPPET_WITH_RELATIONS_SQL}
       WHERE snippets.user_id = $1
         AND (
           $2::text IS NULL
           OR snippets.title ILIKE '%' || $2 || '%'
           OR snippets.description ILIKE '%' || $2 || '%'
           OR snippets.code ILIKE '%' || $2 || '%'
           OR EXISTS (
             SELECT 1
             FROM snippet_tags st
             JOIN tags t ON st.tag_id = t.id
             WHERE st.snippet_id = snippets.id
               AND t.name ILIKE '%' || $2 || '%'
           )
           OR EXISTS (
             SELECT 1
             FROM snippet_collections sc
             JOIN collections c ON sc.collection_id = c.id
             WHERE sc.snippet_id = snippets.id
               AND c.name ILIKE '%' || $2 || '%'
           )
         )
         AND ($3::int IS NULL OR snippets.project_id = $3)
         AND ($4::boolean IS NOT TRUE OR snippets.project_id IS NULL)
         AND (
           $5::int IS NULL OR EXISTS (
             SELECT 1 FROM snippet_collections sc
             WHERE sc.snippet_id = snippets.id AND sc.collection_id = $5
           )
         )
         AND (
           $6::boolean IS NOT TRUE OR NOT EXISTS (
             SELECT 1 FROM snippet_collections sc
             WHERE sc.snippet_id = snippets.id
           )
         )`,
      [user_id, search, projectId, unfiledOnly, collectionId, uncollectedOnly]
    );

    res.status(200).json({ snippets: snippets.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  }
}

export async function getSnippetById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const snippet = await pool.query(
      `${SNIPPET_WITH_RELATIONS_SQL} WHERE snippets.id = $1`,
      [id]
    );

    if (snippet.rows.length === 0) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }

    res.status(200).json({ snippet: snippet.rows[0] });
  } catch (error) {
    console.log(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  }
}

export async function patchSnippetById(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, description, code, language, tags, project_id, collection_ids } =
      req.body;

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE snippets SET title=$1, description=$2, code=$3, language=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [title, description, code, language, id]
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Snippet not found" });
    }

    if ("project_id" in req.body) {
      if (project_id != null) {
        const project = await client.query(
          `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
          [project_id, result.rows[0].user_id]
        );
        if (project.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({ message: "Project not found" });
          return;
        }
      }

      await client.query(
        `UPDATE snippets SET project_id = $1, updated_at = NOW() WHERE id = $2`,
        [project_id ?? null, id]
      );
    }

    await client.query(`DELETE FROM snippet_tags WHERE snippet_id = $1`, [id]);

    for (const name of tags) {
      const tag = await client.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name]
      );
      await client.query(
        `INSERT INTO snippet_tags (snippet_id, tag_id) VALUES ($1, $2)`,
        [id, tag.rows[0].id]
      );
    }

    if ("collection_ids" in req.body) {
      if (!Array.isArray(collection_ids)) {
        await client.query("ROLLBACK");
        res.status(400).json({ message: "collection_ids must be an array" });
        return;
      }

      await client.query(
        `DELETE FROM snippet_collections WHERE snippet_id = $1`,
        [id]
      );

      if (collection_ids.length > 0) {
        const uniqueIds = [...new Set(collection_ids.map(Number))];
        const owned = await client.query(
          `SELECT id FROM collections WHERE user_id = $1 AND id = ANY($2::int[])`,
          [result.rows[0].user_id, uniqueIds]
        );
        if (owned.rows.length !== uniqueIds.length) {
          await client.query("ROLLBACK");
          res.status(404).json({ message: "Collection not found" });
          return;
        }
        for (const collectionId of uniqueIds) {
          await client.query(
            `INSERT INTO snippet_collections (snippet_id, collection_id)
             VALUES ($1, $2)`,
            [id, collectionId]
          );
        }
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      snippet: await fetchSnippetWithRelations(Number(id), client),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  } finally {
    client.release();
  }
}

export async function deleteSnippetById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deletedSnippet = await pool.query(
      `DELETE FROM snippets WHERE id=$1 RETURNING *`,
      [id]
    );

    if (deletedSnippet.rows.length === 0) {
      return res.status(404).json({ message: "Snippet to delete not found" });
    }
    res.status(200).json({ message: `Snippet ${id} deleted successfully` });
  } catch (error) {
    console.log(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  }
}

export async function analyzeSnippet(req: Request, res: Response) {
  try {
    const { code } = req.body;
    const aiResponse: SnippetAnalysis = await geminiAlalysis(code);

    if (!aiResponse) {
      res
        .status(404)
        .json({ message: "Error getting response from AI. Please try again." });
      return;
    }

    res.status(200).json(aiResponse);
  } catch (error) {
    console.log(error);
    const raw = error instanceof Error ? error.message : "Unknown error";
    let message = raw;
    let status = 500;
    try {
      const parsed = JSON.parse(raw);
      const inner = parsed?.error;
      if (inner?.message) {
        message = inner.message;
        if (typeof inner.code === "number" && inner.code >= 400 && inner.code < 600) {
          status = inner.code;
        }
      }
    } catch {
      //keep the raw message
    }
    res.status(status).json({ message });
  }
}
