import { GoogleGenAI } from "@google/genai";
import type { SnippetAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function geminiAlalysis(code: string): Promise<SnippetAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `You're given a code snippet. I want you to analyze it and give out: a distinctive short title, a comprehensive description of what that code does and where it can be used ( keep it up to 400 characters including space ), the programming language primary used in writing the snippet ( where you only give out the language name with first letter uppercase, like 'Python'. If several languages are combined, give out the most important one ), and a list of short catchy tags about the code ( like 'Auth', 'TailwindCSS', keep the tags amount from 3 to 10, first letter uppercase ). VERY IMPORTANT: do NOT give out any plain text, return ONLY a valid JSON object with exactly these keys: "title", "description", "language", "tags"
    Code snippet: ${code}`,
  });

  if (!response.text) throw new Error("Empty response from Gemini");

  const cleaned = response.text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
