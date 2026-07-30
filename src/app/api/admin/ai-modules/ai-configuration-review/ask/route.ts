import { NextRequest } from "next/server";
import { handleAiModuleAsk } from "@/lib/aiModules/apiHandler";

export async function POST(req: NextRequest) {
  return handleAiModuleAsk(req, "aiConfigurationReview");
}
