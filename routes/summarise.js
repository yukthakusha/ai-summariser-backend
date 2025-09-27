import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import fetch from "node-fetch";
import { parse } from "node-html-parser";
import pdfParse from "pdf-parse-fixed";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ---------------- Helper: summarize with fallback ----------------
async function summarizeWithFallback(messages) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.5,
    });
    return response.choices[0].message.content;
  } catch (err) {
    console.warn("gpt-4o-mini failed, falling back to gpt-3.5-turbo:", err.message);
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.5,
    });
    return response.choices[0].message.content;
  }
}

// ---------------- URL Summarization ----------------
router.post("/url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await response.text();

    const root = parse(html);
    const paragraphs = root.querySelectorAll("p").map(p => p.text.trim());
    let text = paragraphs.join("\n");

    if (text.length > 5000) text = text.slice(0, 5000);

    const summary = await summarizeWithFallback([
      { role: "system", content: "Summarize the following webpage in concise points." },
      { role: "user", content: text },
    ]);

    res.json({ summary });
  } catch (err) {
    console.error("URL summarization error:", err);
    res.status(500).json({ error: "Failed to fetch or summarize URL" });
  }
});

// ---------------- File Summarization (DOCX + PDF) ----------------
router.post("/file", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File is required" });

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  let text = "";

  try {
    if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (ext === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      return res.status(400).json({ error: "Unsupported file type. Only DOCX and PDF allowed." });
    }

    if (text.length > 4000) text = text.slice(0, 4000);

    const summary = await summarizeWithFallback([
      { role: "system", content: "Summarize the document in concise points." },
      { role: "user", content: text },
    ]);

    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to summarize file" });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) console.error("Failed to delete file:", err);
    });
  }
});

// **Important: export default so Render can import**
export default router;
