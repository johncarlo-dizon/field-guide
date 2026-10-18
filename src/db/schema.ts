import { pgTable, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  position: text("position").notNull(),
  pinHash: text("pin_hash").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: ts("locked_until"),
  mustChangePin: boolean("must_change_pin").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

/* ---------- Files ---------- */

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  filePath: text("file_path").notNull(),
  thumbPath: text("thumb_path"),
  ocrText: text("ocr_text").notNull().default(""),
  width: integer("width"),
  height: integer("height"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
});

/* ---------- Errors (text and picture blocks in any order) ---------- */

export const errors = pgTable("errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  errorText: text("error_text").notNull().default(""),
  status: text("status", { enum: ["draft", "verified", "outdated"] }).notNull().default("draft"),
  authorId: uuid("author_id").notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
  version: integer("version").notNull().default(1),
}, (t) => [index("errors_author_idx").on(t.authorId)]);

export const errorBlocks = pgTable("error_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  errorId: uuid("error_id").notNull().references(() => errors.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  type: text("type", { enum: ["text", "image"] }).notNull(),
  content: text("content").notNull().default(""),
  attachmentId: uuid("attachment_id").references(() => attachments.id),
  caption: text("caption").notNull().default(""),
}, (t) => [index("error_blocks_error_idx").on(t.errorId)]);


/* ---------- Procedures: procedure > processes > text and picture blocks ---------- */

export const procedures = pgTable("procedures", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
  version: integer("version").notNull().default(1),
}, (t) => [index("procedures_author_idx").on(t.authorId)]);

export const processes = pgTable("processes", {
  id: uuid("id").primaryKey().defaultRandom(),
  procedureId: uuid("procedure_id").notNull().references(() => procedures.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  title: text("title").notNull(),
}, (t) => [index("processes_procedure_idx").on(t.procedureId)]);

export const processBlocks = pgTable("process_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  processId: uuid("process_id").notNull().references(() => processes.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  type: text("type", { enum: ["text", "image"] }).notNull(),
  content: text("content").notNull().default(""),
  attachmentId: uuid("attachment_id").references(() => attachments.id),
  caption: text("caption").notNull().default(""),
}, (t) => [index("process_blocks_process_idx").on(t.processId)]);