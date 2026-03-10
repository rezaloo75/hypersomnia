import type { Folder, Request } from '../types'

export function getTopLevelFolder(
  requestId: string | null,
  requests: Request[],
  folders: Folder[]
): Folder | undefined {
  if (!requestId) return undefined
  const req = requests.find(r => r.id === requestId)
  if (!req?.folderId) return undefined
  let folder = folders.find(f => f.id === req.folderId)
  while (folder?.parentId) {
    folder = folders.find(f => f.id === folder!.parentId)
  }
  return folder
}
