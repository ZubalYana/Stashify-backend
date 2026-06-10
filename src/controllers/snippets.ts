import pool from "../db";
import type { Request, Response } from "express";
import geminiAlalysis from "../AI/gemini";
import type { SnippetAnalysis } from "../types";

export async function createSnippet(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { title, description, code, language, tags, user_id } = req.body;
    if (!title || !description || !code || !language || !tags || !user_id) {
      res.status(400).json({ message: "Missed required credentials" });
      return;
    }
    const result = await client.query(
      `INSERT INTO snippets (title, description, code, language, user_id)
      VALUES($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [title, description, code, language, user_id]
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

    await client.query("COMMIT");
    res.status(201).json({ snippet: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.log(error); //temporary for debugging
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  } finally {
    client.release();
  }
}

export async function getSnippets(req: Request, res: Response) {
  try {
    const { user_id } = req.query;
    const snippets = await pool.query(
      `SELECT * FROM snippets WHERE user_id = $1`,
      [user_id]
    );
    if (snippets.rows.length === 0) {
      res.status(404).json({ message: "Snippets not found" });
      return;
    }
    res.status(200).json({ snippets: snippets.rows });
  } catch (error) {
    console.log(error); //temporary for debugging
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  }
}

export async function getSnippetById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const snippet = await pool.query(`SELECT * FROM snippets WHERE id = $1`, [
      id,
    ]);

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
  try {
    const { id } = req.params;
    const { title, description, code, language } = req.body;
    const newSnippet = await pool.query(
      `UPDATE snippets SET title = $1, description = $2, code = $3, language = $4, updated_at = NOW() WHERE id = $5 RETURNING *`,
      [title, description, code, language, id]
    );

    if (newSnippet.rows.length === 0) {
      return res.status(404).json({ message: "Snippet not found" });
    }

    return res.status(200).json({ snippet: newSnippet.rows[0] });
  } catch (error) {
    console.log(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
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
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  }
}
