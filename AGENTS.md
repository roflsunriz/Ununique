# AGENTS.md

共通ルールは `COMMON-AGENTS.md` を必ず確認し、上位方針として扱う。
このファイルでは `Ununique` 固有の補足だけを記載する。

## Package Manager

Use Bun for this repository.

- Install dependencies with `bun install`.
- Add dependencies with `bun add` or `bun add -d`.
- Run scripts with `bun run <script>`.
- Do not add npm, pnpm, or yarn lockfiles.

## Common Commands

- `bun run format`
- `bun run lint`
- `bun run type-check`
- `bun run build`
- `bun run preview`
