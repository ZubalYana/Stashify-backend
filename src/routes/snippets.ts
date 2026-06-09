import express from 'express';
import { createSnippet, getSnippets, deleteSnippetById, patchSnippetById, getSnippetById, analyzeSnippet } from '../controllers/snippets';

const router = express.Router();

router.post('/', createSnippet)
router.post('/analyze', analyzeSnippet)
router.get('/', getSnippets)
router.get('/:id', getSnippetById)
router.patch('/:id', patchSnippetById)
router.delete('/:id', deleteSnippetById)

export default router;