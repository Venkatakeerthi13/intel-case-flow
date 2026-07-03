import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const GenerateReplyInput = z.object({
  caseNumber: z.string(),
  subject: z.string().min(1),
  description: z.string().nullable().optional(),
  issueType: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  accountName: z.string().nullable().optional(),
  slaDueDate: z.string().nullable().optional(),
});

export const generateCaseReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateReplyInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured for this project");

    const gateway = createLovableAiGatewayProvider(key);

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: [
        "You are an AI assistant for a telecommunications customer support team.",
        "You draft professional, empathetic customer-facing replies for support cases.",
        "Rules:",
        "- Address the customer by name when provided.",
        "- Acknowledge the issue clearly and empathetically.",
        "- Reference the case number.",
        "- Outline concrete next steps or troubleshooting guidance relevant to the issue type.",
        "- If priority is Critical or High, reassure the customer the case is being prioritized and mention the response commitment.",
        "- Keep it under 180 words. Plain text only, no markdown.",
        "- Sign off as 'The Customer Support Team'.",
      ].join("\n"),
      prompt: [
        `Case Number: ${data.caseNumber}`,
        `Subject: ${data.subject}`,
        `Issue Type: ${data.issueType ?? "General"}`,
        `Priority: ${data.priority ?? "Medium"}`,
        data.customerName ? `Customer Name: ${data.customerName}` : null,
        data.accountName ? `Account: ${data.accountName}` : null,
        data.slaDueDate ? `SLA Due: ${data.slaDueDate}` : null,
        "",
        "Case Description:",
        data.description ?? "(no description provided)",
        "",
        "Draft the customer reply now.",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });

    return { reply: text.trim() };
  });
