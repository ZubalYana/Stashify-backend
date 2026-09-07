import pool from "../db";
import type { Request, Response } from "express";
import { fetchSnippetWithRelations } from "../db/snippetSelect";

export async function createCollection(req: Request, res: Response) {
  try {
    const { name, description, user_id } = req.body;

    if (!name || !user_id) {
      res.status(400).json({ message: "Missing required credentials" });
      return;
    }

    const trimmedName = String(name).trim();
    if (!trimmedName) {
      res.status(400).json({ message: "Collection name cannot be empty" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO collections (name, description, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trimmedName, description ?? null, user_id]
    );

    res.status(201).json({
      collection: { ...result.rows[0], snippet_count: 0 },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      res.status(409).json({ message: "Collection name already in use" });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function getCollections(req: Request, res: Response) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      res.status(400).json({ message: "Missing user_id" });
      return;
    }

    const collections = await pool.query(
      `SELECT collections.*,
              COUNT(snippet_collections.snippet_id)::int AS snippet_count
       FROM collections
       LEFT JOIN snippet_collections
         ON snippet_collections.collection_id = collections.id
       WHERE collections.user_id = $1
       GROUP BY collections.id
       ORDER BY collections.created_at DESC`,
      [user_id]
    );

    res.status(200).json({ collections: collections.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function getCollectionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    const collection = await pool.query(
      `SELECT collections.*,
              COUNT(snippet_collections.snippet_id)::int AS snippet_count
       FROM collections
       LEFT JOIN snippet_collections
         ON snippet_collections.collection_id = collections.id
       WHERE collections.id = $1
         AND ($2::int IS NULL OR collections.user_id = $2)
       GROUP BY collections.id`,
      [id, user_id || null]
    );

    if (collection.rows.length === 0) {
      res.status(404).json({ message: "Collection not found" });
      return;
    }

    res.status(200).json({ collection: collection.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function patchCollectionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, user_id } = req.body;

    if (name !== undefined && String(name).trim() === "") {
      res.status(400).json({ message: "Collection name cannot be empty" });
      return;
    }

    const result = await pool.query(
      `UPDATE collections
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3
         AND ($4::int IS NULL OR user_id = $4)
       RETURNING *`,
      [
        name !== undefined ? String(name).trim() : null,
        description !== undefined ? description : null,
        id,
        user_id ?? null,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Collection not found" });
      return;
    }

    const withCount = await pool.query(
      `SELECT collections.*,
              COUNT(snippet_collections.snippet_id)::int AS snippet_count
       FROM collections
       LEFT JOIN snippet_collections
         ON snippet_collections.collection_id = collections.id
       WHERE collections.id = $1
       GROUP BY collections.id`,
      [id]
    );

    res.status(200).json({ collection: withCount.rows[0] });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      res.status(409).json({ message: "Collection name already in use" });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function deleteCollectionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user_id = req.query.user_id ?? req.body?.user_id;

    const deleted = await pool.query(
      `DELETE FROM collections
       WHERE id = $1
         AND ($2::int IS NULL OR user_id = $2)
       RETURNING *`,
      [id, user_id || null]
    );

    if (deleted.rows.length === 0) {
      res.status(404).json({ message: "Collection not found" });
      return;
    }

    res.status(200).json({
      message: `Collection ${id} deleted successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function addSnippetToCollection(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { snippet_id, user_id } = req.body;

    if (!snippet_id) {
      res.status(400).json({ message: "Missing snippet_id" });
      return;
    }

    const collection = await pool.query(
      `SELECT * FROM collections WHERE id = $1 AND ($2::int IS NULL OR user_id = $2)`,
      [id, user_id ?? null]
    );

    if (collection.rows.length === 0) {
      res.status(404).json({ message: "Collection not found" });
      return;
    }

    const snippet = await pool.query(`SELECT * FROM snippets WHERE id = $1`, [
      snippet_id,
    ]);

    if (snippet.rows.length === 0) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }

    if (snippet.rows[0].user_id !== collection.rows[0].user_id) {
      res.status(403).json({
        message: "Snippet and collection must belong to the same user",
      });
      return;
    }

    await pool.query(
      `INSERT INTO snippet_collections (snippet_id, collection_id)
       VALUES ($1, $2)
       ON CONFLICT (snippet_id, collection_id) DO NOTHING`,
      [snippet_id, id]
    );

    res.status(200).json({ snippet: await fetchSnippetWithRelations(snippet_id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function removeSnippetFromCollection(req: Request, res: Response) {
  try {
    const { id, snippetId } = req.params;
    const user_id = req.query.user_id ?? req.body?.user_id;

    const snippet = await pool.query(
      `SELECT id FROM snippets
       WHERE id = $1
         AND ($2::int IS NULL OR user_id = $2)`,
      [snippetId, user_id || null]
    );

    if (snippet.rows.length === 0) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }

    const result = await pool.query(
      `DELETE FROM snippet_collections
       WHERE snippet_id = $1 AND collection_id = $2
       RETURNING snippet_id`,
      [snippetId, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: "Snippet not found in this collection",
      });
      return;
    }

    res.status(200).json({
      snippet: await fetchSnippetWithRelations(Number(snippetId)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}
