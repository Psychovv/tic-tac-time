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
  photo: text("photo"),
});

// board: 9 chars ("." vazio, "X" host, "O" convidado). turn: "X" | "O".
// status: waiting | playing | done. winner: "X" | "O" | "draw" | null.
export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    hostId: text("host_id").notNull(),
    guestId: text("guest_id"),
    targetId: text("target_id"),
    isPrivate: integer("is_private").notNull().default(0),
    board: text("board").notNull().default("........."),
    turn: text("turn").notNull().default("X"),
    status: text("status").notNull().default("waiting"),
    winner: text("winner"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at"),
    // game: "ttt" (jogo da velha) | "rps" (pedra, papel e tesoura).
    // Campos abaixo so valem para "rps": bestOf (1, 3 ou 5), jogada oculta da rodada
    // atual ("R" | "P" | "S", ou null se ainda nao jogou), placar, rodadas resolvidas
    // e o resultado da ultima rodada em JSON ({n, h, g, w}) para a animacao de revelacao.
    game: text("game").notNull().default("ttt"),
    bestOf: integer("best_of").notNull().default(1),
    hostMove: text("host_move"),
    guestMove: text("guest_move"),
    hostScore: integer("host_score").notNull().default(0),
    guestScore: integer("guest_score").notNull().default(0),
    round: integer("round").notNull().default(0),
    last: text("last"),
  },
  (t) => [
    index("matches_status_idx").on(t.status),
    index("matches_target_idx").on(t.targetId),
  ]
);
