import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import snippetRouter from './routes/snippets';
import authRouter from './routes/auth';
import projectRouter from './routes/projects';
import collectionRouter from './routes/collections';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

const PORT = process.env.PORT || 5000;
const corsOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use('/snippets', snippetRouter);
app.use('/projects', projectRouter);
app.use('/collections', collectionRouter);
app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`Server working on PORT: ${PORT}`);
});
