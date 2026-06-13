import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import pool from "../db";

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "Missing credentials" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users ( name, email, password )
            VALUES($1, $2, $3)
            RETURNING *
            `,
      [name, email, hashedPassword]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { user_id: user.id, userEmail: user.email, userName: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique constraint")) {
      res.status(409).json({ message: "Email already in use" });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown Error";
    res.status(500).json({ message: message });
  }
}

export async function logIn(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Missing credentials" });
      return;
    }

    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const match = await bcrypt.compare(password, result.rows[0].password);

    if (match) {
      const token = jwt.sign(
        {
          user_id: result.rows[0].id,
          userEmail: result.rows[0].email,
          userName: result.rows[0].name,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
      );
      res.status(200).json({
        token,
        user: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          email: result.rows[0].email,
        },
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: message });
  }
}
