import "dotenv/config";
import { askAiAssistant } from "../src/lib/aiAssistant/assistant";

async function main() {
  const result = await askAiAssistant("Are there any open QA bugs or SQL Server instances that are unhealthy right now?");
  console.log("Answer:", result.answer);
  console.log("Tools used:", result.toolsUsed.map((t) => t.toolName));
  process.exit(0);
}
main().catch((err) => { console.error("FATAL:", err instanceof Error ? err.message : err); process.exit(1); });
