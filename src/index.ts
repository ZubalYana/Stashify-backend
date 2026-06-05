import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import snippetRouter from './routes/snippets'

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/snippets', snippetRouter)

app.listen(PORT, () => {
  console.log(`Server working on PORT: ${PORT}`);
});
