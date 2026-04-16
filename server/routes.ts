import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertRecapSchema } from "@shared/schema";
import { registerAIRoutes } from "./ai-routes";

export function registerRoutes(httpServer: Server, app: Express) {
  // Register all AI analysis routes
  registerAIRoutes(app);

  // Get all saved recaps
  app.get("/api/recaps", (_req, res) => {
    try {
      const recaps = storage.getRecaps();
      res.json(recaps);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch recaps" });
    }
  });

  // Get single recap
  app.get("/api/recaps/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recap = storage.getRecap(id);
      if (!recap) return res.status(404).json({ error: "Not found" });
      res.json(recap);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch recap" });
    }
  });

  // Create recap
  app.post("/api/recaps", (req, res) => {
    try {
      const parsed = insertRecapSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const recap = storage.createRecap(parsed.data);
      res.status(201).json(recap);
    } catch (e) {
      res.status(500).json({ error: "Failed to create recap" });
    }
  });

  // Delete recap
  app.delete("/api/recaps/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      storage.deleteRecap(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete recap" });
    }
  });
}
