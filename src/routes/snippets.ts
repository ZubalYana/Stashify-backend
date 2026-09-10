import express from 'express';
import { createSnippet, getSnippets, deleteSnippetById, patchSnippetById, getSnippetById, analyzeSnippet } from '../controllers/snippets';
import { requireAuth } from '../middleware/auth';
import { createLimiter, analyzeLimiter } from '../middleware/rateLimit';

const router = express.Router();

router.post('/', requireAuth, createLimiter, createSnippet)
router.post('/analyze', requireAuth, analyzeLimiter, analyzeSnippet)
router.get('/', requireAuth, getSnippets)
router.get('/:id', requireAuth, getSnippetById)
router.patch('/:id', requireAuth, patchSnippetById)
router.delete('/:id', requireAuth, deleteSnippetById)

export default router;