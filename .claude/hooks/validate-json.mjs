// PostToolUse hook: rejects malformed JSON right after Claude writes it,
// so a broken .mcp.json or settings.json is caught in the same turn.
import { readFileSync } from "node:fs";

const raw = await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
});

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}

if (!filePath || !filePath.endsWith(".json")) process.exit(0);

try {
  JSON.parse(readFileSync(filePath, "utf8"));
} catch (err) {
  console.error(`Invalid JSON written to ${filePath}: ${err.message}`);
  process.exit(2);
}
