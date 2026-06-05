import express from 'express';
import { createSnippet, getSnippets, deleteSnippetById, patchSnippetById, getSnippetById } from '../controllers/snippets';

const router = express.Router();

router.post('/', createSnippet)
router.get('/', getSnippets)
router.get('/:id', getSnippetById)
router.patch('/:id', patchSnippetById)
router.delete('/:id', deleteSnippetById)

export default router;