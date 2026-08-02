import { mkdir, rm } from "node:fs/promises";

const entries = [
  ["src/background.ts", "dist/background.js"],
  ["src/content.ts", "dist/content.js"],
  ["src/popup/popup.ts", "dist/popup/popup.js"],
  ["src/options/options.ts", "dist/options/options.js"]
] as const;

await rm("dist", { force: true, recursive: true });
await mkdir("dist", { recursive: true });

for (const [entrypoint, outfile] of entries) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    format: "iife",
    minify: false,
    sourcemap: "none",
    target: "browser"
  });

  if (!result.success) {
    const messages = result.logs.map((log) => log.message).join("\n");
    throw new Error(`Failed to bundle ${entrypoint}:\n${messages}`);
  }

  const output = result.outputs[0];
  if (!output) {
    throw new Error(`Bundler did not produce an output for ${entrypoint}.`);
  }
  await Bun.write(outfile, output);
}
