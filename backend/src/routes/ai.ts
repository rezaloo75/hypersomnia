import { Router, type Request, type Response } from 'express'
import OpenAI from 'openai'

export const aiRouter = Router()

const SYSTEM_PROMPT = `You are an AI assistant embedded in Hypersomnia, a web-based API client similar to Insomnia.
You help users create, modify, and debug API requests.

When the user asks you to create or modify requests, you MUST respond with structured JSON in this exact format:
{
  "explanation": "Brief explanation of what you're doing",
  "operations": [
    { "op": "create_request", "data": { "name": "string", "method": "GET|POST|PUT|PATCH|DELETE", "url": "string", "headers": [], "queryParams": [], "body": { "type": "none|json|raw", "content": "" }, "auth": { "type": "none|bearer|basic|apikey" }, "folderId": null } },
    { "op": "update_request", "id": "request-id", "data": { ...partial request fields... } },
    { "op": "create_folder", "data": { "name": "string" } },
    { "op": "set_env_vars", "vars": { "key": "value" } }
  ]
}

For non-modification questions (troubleshooting, explaining, suggesting), respond with plain text.
The response field "message" should contain plain text responses.

Rules:
- Always use {{variable}} syntax for values that should be environment variables
- For auth tokens, suggest using {{token}} or {{apiKey}} etc.
- Redact/mask sensitive values users share with you
- Keep operation data minimal and correct
- When troubleshooting 4xx/5xx errors, explain common causes and fixes`

aiRouter.post('/', async (req: Request, res: Response) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'OpenAI API key not configured. Set OPENAI_API_KEY in backend environment.' })
    return
  }

  const { messages, context } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    context?: {
      activeRequest?: Record<string, unknown>
      environment?: { name: string; variables: Record<string, string> }
      workspaceTree?: unknown
      lastResponse?: unknown
    }
  }

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' })
    return
  }

  // Build context string
  const contextLines: string[] = []
  if (context?.activeRequest) {
    contextLines.push(`Active Request: ${JSON.stringify(context.activeRequest, null, 2)}`)
  }
  if (context?.environment) {
    contextLines.push(`Active Environment "${context.environment.name}": ${JSON.stringify(context.environment.variables)}`)
  }
  if (context?.lastResponse) {
    contextLines.push(`Last Response: ${JSON.stringify(context.lastResponse, null, 2)}`)
  }
  if (context?.workspaceTree) {
    contextLines.push(`Workspace: ${JSON.stringify(context.workspaceTree, null, 2).slice(0, 2000)}`)
  }

  const contextMessage = contextLines.length > 0
    ? `\n\nCurrent context:\n${contextLines.join('\n\n')}`
    : ''

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + contextMessage },
        ...messages,
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content ?? ''

    // Try to parse as structured response
    try {
      // Extract JSON if wrapped in code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? content.match(/(\{[\s\S]*"operations"[\s\S]*\})/m)
      const jsonStr = jsonMatch ? jsonMatch[1] : content

      const parsed = JSON.parse(jsonStr) as { explanation?: string; operations?: unknown[] }
      if (parsed.operations && Array.isArray(parsed.operations)) {
        res.json({ response: parsed })
        return
      }
    } catch {
      // Not structured JSON — return as plain message
    }

    res.json({ message: content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI request failed'
    console.error('AI error:', msg)
    res.status(500).json({ error: msg })
  }
})
