import { CANONICAL_SYSTEM_PROMPT, buildConversationPrompt } from "../conversation/prompt.js";
import { TEST_SCENARIOS } from "../conversation/test-scenarios.js";

const required = [
  "1. THE CORE GOAL",
  "21. DON'T REPEAT QUESTIONS",
  "33. FINAL SELF-CHECK",
  "REPLY: <reply>",
  "QUICK_REPLIES: <option one> | <option two> | <option three>",
];

for (const text of required) {
  if (!CANONICAL_SYSTEM_PROMPT.includes(text)) {
    throw new Error(`Canonical prompt is missing: ${text}`);
  }
}

if (TEST_SCENARIOS.length < 5 || TEST_SCENARIOS.some((scenario) => !scenario.turns?.length)) {
  throw new Error("Conversation regression fixtures are incomplete.");
}

const runtimePrompt = buildConversationPrompt({
  memoryFacts: ["Work deadlines feel stressful."],
  scopeDirective: "Do not give medication advice.",
});

if (!runtimePrompt.includes("Work deadlines feel stressful.") || !runtimePrompt.includes("Do not give medication advice.")) {
  throw new Error("Runtime memory or safety context was not included.");
}

console.log(`Conversation checks passed: ${TEST_SCENARIOS.length} frozen scenarios available.`);
