import type { Folder, Request, KeyValuePair } from '../types'

const FOL_ID = 'seed-breweries'

export const seedFolders: Folder[] = [
  { id: FOL_ID, name: 'Breweries', sortOrder: 0, variables: { baseUrl: 'https://api.openbrewerydb.org/v1' } },
]

function param(id: string, key: string): KeyValuePair {
  return { id, key, value: '', enabled: false }
}

export const seedRequests: Request[] = [
  {
    id: 'seed-list-breweries',
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

export const SEED_ACTIVE_REQUEST_ID = 'seed-list-breweries'
