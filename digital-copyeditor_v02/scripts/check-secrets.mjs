import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = [
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/u },
  { name: "OpenAI-style API key", pattern: /sk-[0-9A-Za-z]{20,}/u },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u },
  { name: "bearer token", pattern: /Authorization\s*:\s*Bearer\s+[0-9A-Za-z._-]{20,}/iu },
];

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const findings = [];

for (const file of files) {
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (contents.includes("\0")) continue;
  for (const { name, pattern } of patterns) {
    if (pattern.test(contents)) findings.push(`${file}: ${name}`);
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found in tracked files:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} tracked files checked).`);
