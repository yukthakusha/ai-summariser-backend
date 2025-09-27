import express from "express";
import cors from "cors";
import summariseRoutes from "./routes/summarise.js";
//import db from "./db.js"; // MySQL connection

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/summarise", summariseRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("✅ AI Summarizer Backend is running!");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

