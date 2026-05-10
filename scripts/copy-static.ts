import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const staticFiles = [
  ["src/popup/popup.html", "dist/popup/popup.html"],
  ["src/options/options.html", "dist/options/options.html"]
] as const;

for (const [source, destination] of staticFiles) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function copyDirectory(sourceDirectory: string, destinationDirectory: string): Promise<void> {
  await mkdir(destinationDirectory, { recursive: true });

  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(sourceDirectory, entry.name);
    const destinationPath = join(destinationDirectory, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await mkdir(dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
    }
  }
}

await copyDirectory("src/_locales", "_locales");
