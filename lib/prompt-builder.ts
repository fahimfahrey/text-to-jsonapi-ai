export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type JsonSchema = Record<string, unknown>

export function buildExtractionPrompt(
  rawText: string,
  targetSchema: JsonSchema,
): ChatMessage[] {
  const schemaJson = JSON.stringify(targetSchema, null, 2)

  const system =
    'You are a strict data extraction engine. ' +
    'Your sole function is to read the user-provided text and extract data into JSON that conforms exactly to the schema below. ' +
    'Output ONLY raw JSON. No prose, no explanations, no apologies, no markdown, no code fences, no commentary before or after. ' +
    'Do not wrap the JSON in ```json or any other delimiter. ' +
    'The first character of your response MUST be `{` or `[` and the last character MUST be `}` or `]`. ' +
    'Every key required by the schema must be present. If a value cannot be found in the input text, use null. ' +
    'Do not invent, infer beyond the text, or add keys not defined in the schema.\n\n' +
    `SCHEMA:\n${schemaJson}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: rawText },
  ]
}
