# Jogo da velha do setor

Next.js 15 + Drizzle + Turso (libSQL). Convites e partidas por polling (2s).

## Rodar local
1. `npm install`
2. `cp .env.example .env` (o padrao usa um SQLite local em `local.db`)
3. `npm run db:push` (cria as tabelas)
4. `npm run dev` e abra http://localhost:3000 (use duas abas/navegadores para testar)

## Producao (Vercel + Turso)
1. `turso db create jogo-da-velha` e `turso db show jogo-da-velha --url` / `turso db tokens create jogo-da-velha`
2. Rode `npm run db:push` uma vez com `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` apontando pro Turso.
3. Na Vercel, crie as mesmas duas variaveis de ambiente e faca o deploy.
