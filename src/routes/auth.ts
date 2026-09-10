import { Router } from "express";
import { register, logIn } from "../controllers/auth";
import { authLimiter } from "../middleware/rateLimit";
const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, logIn);

export default router;