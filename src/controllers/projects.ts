import pool from "../db";
import type { Request, Response } from "express";

async function getSnippetWithTags(snippetId: number) {
  const full = await pool.query(
    `SELECT snippets.*, 
     ARRAY_AGG(tags.name) FILTER (WHERE tags.name IS NOT NULL) as tags
     FROM snippets
     LEFT JOIN snippet_tags ON snippets.id = snippet_tags.snippet_id
     LEFT JOIN tags ON snippet_tags.tag_id = tags.id
     WHERE snippets.id = $1
     GROUP BY snippets.id`,
    [snippetId]
  );
  return full.rows[0];
}

export async function createProject(req: Request, res: Response) {
  try {
    const { name, description, user_id } = req.body;

    if (!name || !user_id) {
      res.status(400).json({ message: "Missing required credentials" });
      return;
    }

    const trimmedName = String(name).trim();
    if (!trimmedName) {
      res.status(400).json({ message: "Project name cannot be empty" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [trimmedName, description ?? null, user_id]
    );

    res.status(201).json({
      project: { ...result.rows[0], snippet_count: 0 },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      res.status(409).json({ message: "Project name already in use" });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function getProjects(req: Request, res: Response) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      res.status(400).json({ message: "Missing user_id" });
      return;
    }

    const projects = await pool.query(
      `SELECT projects.*,
              COUNT(snippets.id)::int AS snippet_count
       FROM projects
       LEFT JOIN snippets ON snippets.project_id = projects.id
       WHERE projects.user_id = $1
       GROUP BY projects.id
       ORDER BY projects.created_at DESC`,
      [user_id]
    );

    res.status(200).json({ projects: projects.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function getProjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    const project = await pool.query(
      `SELECT projects.*,
              COUNT(snippets.id)::int AS snippet_count
       FROM projects
       LEFT JOIN snippets ON snippets.project_id = projects.id
       WHERE projects.id = $1
         AND ($2::int IS NULL OR projects.user_id = $2)
       GROUP BY projects.id`,
      [id, user_id || null]
    );

    if (project.rows.length === 0) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({ project: project.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function patchProjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, user_id } = req.body;

    if (name !== undefined && String(name).trim() === "") {
      res.status(400).json({ message: "Project name cannot be empty" });
      return;
    }

    const result = await pool.query(
      `UPDATE projects
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
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const withCount = await pool.query(
      `SELECT projects.*,
              COUNT(snippets.id)::int AS snippet_count
       FROM projects
       LEFT JOIN snippets ON snippets.project_id = projects.id
       WHERE projects.id = $1
       GROUP BY projects.id`,
      [id]
    );

    res.status(200).json({ project: withCount.rows[0] });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      res.status(409).json({ message: "Project name already in use" });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function deleteProjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user_id = req.query.user_id ?? req.body?.user_id;

    const deleted = await pool.query(
      `DELETE FROM projects
       WHERE id = $1
         AND ($2::int IS NULL OR user_id = $2)
       RETURNING *`,
      [id, user_id || null]
    );

    if (deleted.rows.length === 0) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({
      message: `Project ${id} deleted successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function addSnippetToProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { snippet_id, user_id } = req.body;

    if (!snippet_id) {
      res.status(400).json({ message: "Missing snippet_id" });
      return;
    }

    const project = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND ($2::int IS NULL OR user_id = $2)`,
      [id, user_id ?? null]
    );

    if (project.rows.length === 0) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const snippet = await pool.query(`SELECT * FROM snippets WHERE id = $1`, [
      snippet_id,
    ]);

    if (snippet.rows.length === 0) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }

    if (snippet.rows[0].user_id !== project.rows[0].user_id) {
      res.status(403).json({
        message: "Snippet and project must belong to the same user",
      });
      return;
    }

    await pool.query(
      `UPDATE snippets SET project_id = $1, updated_at = NOW() WHERE id = $2`,
      [id, snippet_id]
    );

    res.status(200).json({ snippet: await getSnippetWithTags(snippet_id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}

export async function removeSnippetFromProject(req: Request, res: Response) {
  try {
    const { id, snippetId } = req.params;
    const user_id = req.query.user_id ?? req.body?.user_id;

    const result = await pool.query(
      `UPDATE snippets
       SET project_id = NULL, updated_at = NOW()
       WHERE id = $1
         AND project_id = $2
         AND ($3::int IS NULL OR user_id = $3)
       RETURNING id`,
      [snippetId, id, user_id || null]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: "Snippet not found in this project",
      });
      return;
    }

    res.status(200).json({
      snippet: await getSnippetWithTags(Number(snippetId)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
}
