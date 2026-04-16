import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Table to store saved recaps
export const recaps = sqliteTable("recaps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyName: text("property_name").notNull().default(""),
  createdAt: text("created_at").notNull(),

  // Pickup months (3 months)
  month1Label: text("month1_label").notNull().default(""),
  month1RN: text("month1_rn").notNull().default(""),
  month1Rev: text("month1_rev").notNull().default(""),
  month1ADR: text("month1_adr").notNull().default(""),
  month1Delta: text("month1_delta").notNull().default(""),

  month2Label: text("month2_label").notNull().default(""),
  month2RN: text("month2_rn").notNull().default(""),
  month2Rev: text("month2_rev").notNull().default(""),
  month2ADR: text("month2_adr").notNull().default(""),
  month2Delta: text("month2_delta").notNull().default(""),

  month3Label: text("month3_label").notNull().default(""),
  month3RN: text("month3_rn").notNull().default(""),
  month3Rev: text("month3_rev").notNull().default(""),
  month3ADR: text("month3_adr").notNull().default(""),
  month3Delta: text("month3_delta").notNull().default(""),

  // Pricing Recommendations
  barAdjustments: text("bar_adjustments").notNull().default(""),
  losStrategy: text("los_strategy").notNull().default(""),
  compressionAdjustments: text("compression_adjustments").notNull().default(""),

  // COSTAR
  costarPerformance: text("costar_performance").notNull().default(""),
  costarKeyTakeaway: text("costar_key_takeaway").notNull().default(""),

  // OTA Production
  otaProduction: text("ota_production").notNull().default(""),
  topPromotions: text("top_promotions").notNull().default(""),
  otaOpportunities: text("ota_opportunities").notNull().default(""),

  // Rate Checks
  rateCheck1Date: text("rate_check1_date").notNull().default(""),
  rateCheck1Pulse: text("rate_check1_pulse").notNull().default(""),
  rateCheck1Expedia: text("rate_check1_expedia").notNull().default(""),
  rateCheck2Date: text("rate_check2_date").notNull().default(""),
  rateCheck2Pulse: text("rate_check2_pulse").notNull().default(""),
  rateCheck2Expedia: text("rate_check2_expedia").notNull().default(""),

  // Business Mix
  businessMixKeyTakeaway: text("business_mix_key_takeaway").notNull().default(""),

  // Additional notes
  additionalNotes: text("additional_notes").notNull().default(""),
});

export const insertRecapSchema = createInsertSchema(recaps).omit({ id: true });
export type InsertRecap = z.infer<typeof insertRecapSchema>;
export type Recap = typeof recaps.$inferSelect;
