type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export async function callOpenAiJson<T>(messages: ChatMessage[]): Promise<T> {
  const { apiKey, baseUrl, model } = getOpenAiConfig();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada.");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Resposta vazia da OpenAI API.");
  }

  return JSON.parse(content) as T;
}
