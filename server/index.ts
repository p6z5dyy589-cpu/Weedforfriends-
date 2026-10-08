import path from "node:path";
import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import { createApp } from "./app";
import { MySqlStore } from "./store/mysqlStore";
import { DiskFileStore } from "./files/fileStore";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}
const uploadDir = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "uploads");

const app = createApp(new MySqlStore(drizzle(databaseUrl)), new DiskFileStore(uploadDir));
const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(import.meta.dirname, "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, () => console.log(`Fertigung Einfach läuft auf Port ${port}`));
