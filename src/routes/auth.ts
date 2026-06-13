import { Router } from "express";
import { register, logIn } from "../controllers/auth";
const router = Router();

router.post('/register', register);
router.post('/login', logIn);

export default router;