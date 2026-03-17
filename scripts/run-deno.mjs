import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const configuredBinary = process.env.DENO_BIN;
const localCandidates = [
  join(repoRoot, ".tools", "deno", "deno.exe"),
  join(repoRoot, ".tools", "deno", "deno"),
];

function resolveDenoBinary() {
  if (configuredBinary) {
    return configuredBinary;
  }

  for (const candidate of localCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "deno";
}

const denoBinary = resolveDenoBinary();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-deno.mjs <deno args...>");
  process.exit(1);
}

const result = spawnSync(denoBinary, args, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.error(`Unable to find Deno binary: ${denoBinary}`);
    console.error("Set DENO_BIN or install Deno on PATH.");
  } else {
    console.error(result.error.message);
  }

  process.exit(1);
}

process.exit(result.status ?? 1);
