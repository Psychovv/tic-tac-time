import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull().unique(),
  pin: text("pin"),
  attempts: integer("attempts").notNull().default(0),
  lockedAt: integer("locked_at"),
  points: integer("points").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
});

// board: 9 chars ("." vazio, "X" host, "O" convidado). turn: "X" | "O".
// status: waiting | playing | done. winner: "X" | "O" | "draw" | null.
export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id").notNull(),
    guestId: text("guest_id"),
    board: text("board").notNull().default("........."),
    turn: text("turn").notNull().default("X"),
    status: text("status").notNull().default("waiting"),
    winner: text("winner"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("matches_status_idx").on(t.status)]
);
