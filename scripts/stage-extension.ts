import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const outputDirectory = "build/extension";

const files = ["manifest.json", "LICENSE"] as const;
const directories = ["dist", "_locales", "icons"] as const;

await rm(outputDirectory, { force: true, recursive: true });

for (const file of files) {
  const destination = join(outputDirectory, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(file, destination);
}

for (const directory of directories) {
  await cp(directory, join(outputDirectory, directory), { recursive: true });
}
