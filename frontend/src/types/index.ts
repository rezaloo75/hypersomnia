export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey'

export type BodyType = 'none' | 'json' | 'form-urlencoded' | 'raw'

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface Auth {
  type: AuthType
  // bearer
  token?: string
  // basic
  username?: string
  password?: string
  // api key
  apiKey?: string
  apiKeyName?: string
  apiKeyIn?: 'header' | 'query'
}

export interface RequestBody {
  type: BodyType
  content: string
}

export interface RequestSettings {
  followRedirects?: boolean
  timeout?: number
}

export interface Folder {
  id: string
  name: string
  parentId?: string
  sortOrder: number
  variables?: Record<string, string>
  kongCpType?: string
  kongCpEndpoint?: string
  kongRegion?: string
  kongDebug?: { enabled: boolean; token: string }
}

export interface Request {
  id: string
  folderId?: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  body: RequestBody
  auth: Auth
  settings: RequestSettings
  sortOrder: number
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

export interface RequestExecution {
  id: string
  requestId: string
  requestName: string
  timestamp: string
  request: {
    method: HttpMethod
    url: string
    headers: Record<string, string>
    body?: string
  }
  response: ResponseData
  error?: string
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AIOperationType = 'create_request' | 'update_request' | 'create_folder' | 'set_folder_vars' | 'delete_request'

export interface AIOperation {
  op: AIOperationType
  id?: string
  data?: Partial<Request>
  vars?: Record<string, string>
  folderId?: string
}

export interface AIResponse {
  explanation: string
  operations: AIOperation[]
}

export interface DataExport {
  version: '1'
  exportedAt: string
  folders: Folder[]
  requests: Request[]
}
