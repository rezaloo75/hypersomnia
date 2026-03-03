import type { Workspace, Folder, Request, Environment, KeyValuePair } from '../types'

const WS_ID  = 'seed-brews-api'
const FOL_ID = 'seed-breweries'
const ENV_ID = 'seed-test-env'

export const seedWorkspace: Workspace = {
  id: WS_ID,
  name: 'Brews API',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const seedFolders: Folder[] = [
  { id: FOL_ID, workspaceId: WS_ID, name: 'Breweries', sortOrder: 0 },
]

export const seedEnvironment: Environment = {
  id: ENV_ID,
  workspaceId: WS_ID,
  name: 'Test',
  variables: { baseUrl: 'https://api.openbrewerydb.org/v1' },
}

function param(id: string, key: string): KeyValuePair {
  return { id, key, value: '', enabled: false }
}

export const seedRequests: Request[] = [
  {
    id: 'seed-list-breweries',
    workspaceId: WS_ID,
    folderId: FOL_ID,
    name: 'List breweries',
    method: 'GET',
    url: '{{baseUrl}}/breweries',
    headers: [],
    queryParams: [
      param('qp-page',      'page'),
      param('qp-per_page',  'per_page'),
      param('qp-by_name',   'by_name'),
      param('qp-by_city',   'by_city'),
      param('qp-by_state',  'by_state'),
      param('qp-by_postal', 'by_postal'),
      param('qp-by_type',   'by_type'),
    ],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    settings: {},
    sortOrder: 0,
  },
  {
    id: 'seed-get-brewery-by-id',
    workspaceId: WS_ID,
    folderId: FOL_ID,
    name: 'Get brewery by ID',
    method: 'GET',
    url: '{{baseUrl}}/breweries/{id}',
    headers: [],
    queryParams: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    settings: {},
    sortOrder: 1,
  },
  {
    id: 'seed-random-breweries',
    workspaceId: WS_ID,
    folderId: FOL_ID,
    name: 'Get random breweries',
    method: 'GET',
    url: '{{baseUrl}}/breweries/random',
    headers: [],
    queryParams: [
      param('qp-size', 'size'),
    ],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    settings: {},
    sortOrder: 2,
  },
]

export const SEED_ACTIVE_REQUEST_ID  = 'seed-list-breweries'
export const SEED_ACTIVE_ENV_ID      = ENV_ID
