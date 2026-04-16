import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { recaps, type InsertRecap, type Recap } from "@shared/schema";
import { eq } from "drizzle-orm";

const sqlite = new Database("db.sqlite");
const db = drizzle(sqlite);

// Create table if not exists
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS recaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    month1_label TEXT NOT NULL DEFAULT '',
    month1_rn TEXT NOT NULL DEFAULT '',
    month1_rev TEXT NOT NULL DEFAULT '',
    month1_adr TEXT NOT NULL DEFAULT '',
    month1_delta TEXT NOT NULL DEFAULT '',
    month2_label TEXT NOT NULL DEFAULT '',
    month2_rn TEXT NOT NULL DEFAULT '',
    month2_rev TEXT NOT NULL DEFAULT '',
    month2_adr TEXT NOT NULL DEFAULT '',
    month2_delta TEXT NOT NULL DEFAULT '',
    month3_label TEXT NOT NULL DEFAULT '',
    month3_rn TEXT NOT NULL DEFAULT '',
    month3_rev TEXT NOT NULL DEFAULT '',
    month3_adr TEXT NOT NULL DEFAULT '',
    month3_delta TEXT NOT NULL DEFAULT '',
    bar_adjustments TEXT NOT NULL DEFAULT '',
    los_strategy TEXT NOT NULL DEFAULT '',
    compression_adjustments TEXT NOT NULL DEFAULT '',
    costar_performance TEXT NOT NULL DEFAULT '',
    costar_key_takeaway TEXT NOT NULL DEFAULT '',
    ota_production TEXT NOT NULL DEFAULT '',
    top_promotions TEXT NOT NULL DEFAULT '',
    ota_opportunities TEXT NOT NULL DEFAULT '',
    rate_check1_date TEXT NOT NULL DEFAULT '',
    rate_check1_pulse TEXT NOT NULL DEFAULT '',
    rate_check1_expedia TEXT NOT NULL DEFAULT '',
    rate_check2_date TEXT NOT NULL DEFAULT '',
    rate_check2_pulse TEXT NOT NULL DEFAULT '',
    rate_check2_expedia TEXT NOT NULL DEFAULT '',
    business_mix_key_takeaway TEXT NOT NULL DEFAULT '',
    additional_notes TEXT NOT NULL DEFAULT ''
  )
`);

export interface IStorage {
  createRecap(recap: InsertRecap): Recap;
  getRecaps(): Recap[];
  getRecap(id: number): Recap | undefined;
  deleteRecap(id: number): void;
}

export class Storage implements IStorage {
  createRecap(recap: InsertRecap): Recap {
    return db.insert(recaps).values(recap).returning().get();
  }

  getRecaps(): Recap[] {
    return db.select().from(recaps).all().sort((a, b) => b.id - a.id);
  }

  getRecap(id: number): Recap | undefined {
    return db.select().from(recaps).where(eq(recaps.id, id)).get();
  }

  deleteRecap(id: number): void {
    db.delete(recaps).where(eq(recaps.id, id)).run();
  }
}

export const storage = new Storage();
