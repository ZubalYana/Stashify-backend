import pool from "../db";
import type { Request, Response } from "express";

export async function createSnippet(req: Request, res: Response) {
  try {
    const { title, description, code, language, user_id } = req.body;
    if (!title || !description || !code || !language || !user_id) {
      res.status(400).json({ message: "Missed required credentials" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO snippets (title, description, code, language, user_id)
      VALUES($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [title, description, code, language, user_id]
    );

    res.status(201).json({ snippet: result.rows[0] });
  } catch (error) {
    console.log(error); //temporary for debugging
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
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
