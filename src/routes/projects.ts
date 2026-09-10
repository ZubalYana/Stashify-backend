import express from "express";
import {
  createProject,
  getProjects,
  getProjectById,
  patchProjectById,
  deleteProjectById,
  addSnippetToProject,
  removeSnippetFromProject,
} from "../controllers/projects";
import { requireAuth } from "../middleware/auth";
import { createLimiter } from "../middleware/rateLimit";

const router = express.Router();

router.post("/", requireAuth, createLimiter, createProject);
router.get("/", requireAuth, getProjects);
router.get("/:id", requireAuth, getProjectById);
router.patch("/:id", requireAuth, patchProjectById);
router.delete("/:id", requireAuth, deleteProjectById);
router.post("/:id/snippets", requireAuth, addSnippetToProject);
router.delete("/:id/snippets/:snippetId", requireAuth, removeSnippetFromProject);

export default router;
