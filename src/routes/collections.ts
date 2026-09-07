import express from "express";
import {
  createCollection,
  getCollections,
  getCollectionById,
  patchCollectionById,
  deleteCollectionById,
  addSnippetToCollection,
  removeSnippetFromCollection,
} from "../controllers/collections";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

router.post("/", requireAuth, createCollection);
router.get("/", requireAuth, getCollections);
router.get("/:id", requireAuth, getCollectionById);
router.patch("/:id", requireAuth, patchCollectionById);
router.delete("/:id", requireAuth, deleteCollectionById);
router.post("/:id/snippets", requireAuth, addSnippetToCollection);
router.delete(
  "/:id/snippets/:snippetId",
  requireAuth,
  removeSnippetFromCollection
);

export default router;
