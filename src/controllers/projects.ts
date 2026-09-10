import pool from "../db";
import type { Request, Response } from "express";
import { fetchSnippetWithRelations } from "../db/snippetSelect";
import { getAuthUserId } from "../middleware/auth";

const INTERNAL_ERROR = "Unknown error";

export async function createProject(req: Request, res: Response) {
  try {
    const userId = getAuthUserId(req);
    const { name, description } = req.body;

    if (!name) {
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
      [trimmedName, description ?? null, userId]
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
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}

export async function getProjects(req: Request, res: Response) {
  try {
    const userId = getAuthUserId(req);

    const projects = await pool.query(
      `SELECT projects.*,
              COUNT(snippets.id)::int AS snippet_count
       FROM projects
       LEFT JOIN snippets ON snippets.project_id = projects.id
       WHERE projects.user_id = $1
       GROUP BY projects.id
       ORDER BY projects.created_at DESC`,
      [userId]
    );

    res.status(200).json({ projects: projects.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}

export async function getProjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = getAuthUserId(req);

    const project = await pool.query(
      `SELECT projects.*,
              COUNT(snippets.id)::int AS snippet_count
       FROM projects
       LEFT JOIN snippets ON snippets.project_id = projects.id
       WHERE projects.id = $1 AND projects.user_id = $2
       GROUP BY projects.id`,
      [id, userId]
    );

    if (project.rows.length === 0) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({ project: project.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}

export async function patchProjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = getAuthUserId(req);
    const { name, description } = req.body;

    if (name !== undefined && String(name).trim() === "") {
      res.status(400).json({ message: "Project name cannot be empty" });
      return;
    }

    const result = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        name !== undefined ? String(name).trim() : null,
        description !== undefined ? description : null,
        id,
        userId,
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
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}

export async function deleteProjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = getAuthUserId(req);

    const deleted = await pool.query(
      `DELETE FROM projects
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (deleted.rows.length === 0) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(200).json({
      message: `Project ${id} deleted successfully`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}

export async function addSnippetToProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = getAuthUserId(req);
    const { snippet_id } = req.body;

    if (!snippet_id) {
      res.status(400).json({ message: "Missing snippet_id" });
      return;
    }

    const project = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (project.rows.length === 0) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const snippet = await pool.query(
      `SELECT * FROM snippets WHERE id = $1 AND user_id = $2`,
      [snippet_id, userId]
    );

    if (snippet.rows.length === 0) {
      res.status(404).json({ message: "Snippet not found" });
      return;
    }

    await pool.query(
      `UPDATE snippets SET project_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [id, snippet_id, userId]
    );

    res.status(200).json({ snippet: await fetchSnippetWithRelations(snippet_id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}

export async function removeSnippetFromProject(req: Request, res: Response) {
  try {
    const { id, snippetId } = req.params;
    const userId = getAuthUserId(req);

    const result = await pool.query(
      `UPDATE snippets
       SET project_id = NULL, updated_at = NOW()
       WHERE id = $1
         AND project_id = $2
         AND user_id = $3
       RETURNING id`,
      [snippetId, id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        message: "Snippet not found in this project",
      });
      return;
    }

    res.status(200).json({
      snippet: await fetchSnippetWithRelations(Number(snippetId)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: INTERNAL_ERROR });
  }
}
