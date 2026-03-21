import fs from "fs";
import path from "path";
import dotenv from "dotenv";

let hasLoaded = false;

const envCandidates = () => [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
];

export const loadEnv = () => {
  if (hasLoaded) return;

  for (const candidate of envCandidates()) {
    if (!fs.existsSync(candidate)) continue;
    dotenv.config({ path: candidate });
    hasLoaded = true;
    return;
  }

  hasLoaded = true;
};
