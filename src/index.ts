import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import snippetRouter from './routes/snippets';
import authRouter from './routes/auth';
import projectRouter from './routes/projects';
import collectionRouter from './routes/collections';

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/snippets', snippetRouter);
app.use('/projects', projectRouter);
app.use('/collections', collectionRouter);
app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`Server working on PORT: ${PORT}`);
});
