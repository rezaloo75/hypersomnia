import { Router, type Request, type Response } from 'express'
import SwaggerParser from '@apidevtools/swagger-parser'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'
import type { OpenAPI, OpenAPIV3 } from 'openapi-types'

export const importRouter = Router()

importRouter.post('/openapi', async (req: Request, res: Response) => {
  const { spec, filename = 'spec.json' } = req.body as { spec: string; filename?: string }

  if (!spec) {
    res.status(400).json({ error: 'spec is required' })
    return
  }

  let rawSpec: unknown
  try {
    // Try JSON first, then YAML
    if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      rawSpec = yaml.load(spec)
    } else {
      try {
        rawSpec = JSON.parse(spec)
      } catch {
        rawSpec = yaml.load(spec)
      }
    }
  } catch {
    res.status(400).json({ error: 'Failed to parse spec as JSON or YAML' })
    return
  }

  let parsed: OpenAPI.Document
  try {
    // Try full validation first, fall back to parse-only for lenient import
    try {
      parsed = await SwaggerParser.validate(rawSpec as OpenAPI.Document)
    } catch {
      parsed = await SwaggerParser.parse(rawSpec as OpenAPI.Document)
    }
  } catch (err) {
    res.status(400).json({ error: `Failed to parse OpenAPI spec: ${err instanceof Error ? err.message : 'Unknown error'}` })
    return
  }

  // Only handle OAS3
  if (!('openapi' in parsed) || !String((parsed as Record<string, unknown>).openapi).startsWith('3')) {
    res.status(400).json({ error: 'Only OpenAPI 3.x specs are supported (openapi: "3.x.x")' })
    return
  }

  const oas3 = parsed as OpenAPIV3.Document
  const folders: Array<{ id: string; name: string; sortOrder: number }> = []
  const requests: Array<{
    id: string; name: string; method: string; url: string; folderId?: string
    headers: Array<{ id: string; key: string; value: string; enabled: boolean }>
    queryParams: Array<{ id: string; key: string; value: string; enabled: boolean }>
    body: { type: string; content: string }
    auth: { type: string }
    settings: Record<string, unknown>
    sortOrder: number
  }> = []

  // Map tags to folders
  const tagMap = new Map<string, string>() // tag name -> folder id
  const tagList = oas3.tags ?? []
  for (const tag of tagList) {
    const folderId = uuid()
    tagMap.set(tag.name, folderId)
    folders.push({ id: folderId, name: tag.name, sortOrder: folders.length })
  }

  const baseUrl = getBaseUrl(oas3)
  let sortOrder = 0

  for (const [path, pathItem] of Object.entries(oas3.paths ?? {})) {
    if (!pathItem) continue
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const

    for (const method of methods) {
      const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined
      if (!operation) continue

      const opId = operation.operationId ?? `${method.toUpperCase()} ${path}`
      const tags = operation.tags ?? []

      // Ensure folder for each tag
      let folderId: string | undefined
      if (tags.length > 0) {
        const tag = tags[0]
        if (!tagMap.has(tag)) {
          const newId = uuid()
          tagMap.set(tag, newId)
          folders.push({ id: newId, name: tag, sortOrder: folders.length })
        }
        folderId = tagMap.get(tag)
      }

      // Build query params from operation parameters
      const queryParams: Array<{ id: string; key: string; value: string; enabled: boolean }> = []
      const headerPairs: Array<{ id: string; key: string; value: string; enabled: boolean }> = []

      for (const param of (operation.parameters ?? []) as OpenAPIV3.ParameterObject[]) {
        if (!param.name) continue
        const pair = { id: uuid(), key: param.name, value: '', enabled: !param.required }
        if (param.in === 'query') queryParams.push(pair)
        else if (param.in === 'header') headerPairs.push(pair)
      }

      // Build body
      let body = { type: 'none', content: '' }
      const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject | undefined
      if (requestBody?.content) {
        if (requestBody.content['application/json']) {
          const schema = requestBody.content['application/json'].schema as OpenAPIV3.SchemaObject | undefined
          body = { type: 'json', content: schemaToExample(schema) }
        } else {
          body = { type: 'raw', content: '' }
        }
      }

      requests.push({
        id: uuid(),
        name: operation.summary ?? opId,
        method: method.toUpperCase(),
        url: `${baseUrl}${path}`,
        folderId,
        headers: headerPairs,
        queryParams,
        body,
        auth: { type: 'none' },
        settings: {},
        sortOrder: sortOrder++,
      })
    }
  }

  res.json({ folders, requests })
})

function getBaseUrl(doc: OpenAPIV3.Document): string {
  const server = doc.servers?.[0]
  if (!server) return ''
  // Use a variable reference if multiple servers
  if (doc.servers && doc.servers.length > 1) return '{{baseUrl}}'
  // Keep path only if template variables exist
  const url = server.url
  if (url.includes('{')) return '{{baseUrl}}'
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function schemaToExample(schema?: OpenAPIV3.SchemaObject): string {
  if (!schema) return '{}'
  try {
    return JSON.stringify(buildExample(schema), null, 2)
  } catch {
    return '{}'
  }
}

function buildExample(schema: OpenAPIV3.SchemaObject): unknown {
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default

  switch (schema.type) {
    case 'object': {
      const obj: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        obj[k] = buildExample(v as OpenAPIV3.SchemaObject)
      }
      return obj
    }
    case 'array':
      return [buildExample((schema.items as OpenAPIV3.SchemaObject) ?? {})]
    case 'string':
      return schema.enum?.[0] ?? 'string'
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return true
    default:
      return null
  }
}
