import express from 'express';
const router = express.Router();
import { createSnippet, getSnippets } from '../controllers/snippets';

router.post('/', createSnippet)
router.get('/', getSnippets)

export default router;