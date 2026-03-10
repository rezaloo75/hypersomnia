import { useMemo, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { XMarkIcon, BugAntIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { getTopLevelFolder } from '../../utils/folders'
import { cpKindFromClusterType, extractGeo, fetchDedicatedCpDebugToken } from '../../utils/konnectApi'
import { storage } from '../../db/storage'
import type { Folder, Request } from '../../types'

interface Props {
  requestId: string
  onClose: () => void
}

/** Recursively collect all requests under a folder (including sub-folders). */
function getAllRequestsUnder(folderId: string, folders: Folder[], requests: Request[]): Request[] {
  const direct = requests.filter(r => r.folderId === folderId)
  const sub = folders.filter(f => f.parentId === folderId)
  return [...direct, ...sub.flatMap(f => getAllRequestsUnder(f.id, folders, requests))]
}

const NEON = '#6fdc0e'

export function KonnectDebugModal({ requestId, onClose }: Props) {
  const { requests, folders, updateRequest, updateFolder } = useWorkspaceStore()
  const request = requests.find(r => r.id === requestId)
  const topLevelFolder = getTopLevelFolder(requestId, requests, folders)

  const cpType = cpKindFromClusterType(topLevelFolder?.kongCpType)
  const isServerless = cpType === 'serverless'
  const isDedicated = cpType === 'dedicated'

  // Detect if debug headers are already on this request
  const existingTokenHeader = request?.headers.find(h => h.enabled && h.key === 'X-Kong-Request-Debug-Token')
  const isEnabled = !!(request?.headers.find(h => h.enabled && h.key === 'X-Kong-Request-Debug'))

  // Find token already in use by any other request in this CP
  const cpTokenInUse = useMemo(() => {
    if (!topLevelFolder) return null
    const cpRequests = getAllRequestsUnder(topLevelFolder.id, folders, requests)
    for (const r of cpRequests) {
      if (r.id === requestId) continue
      const t = r.headers.find(h => h.enabled && h.key === 'X-Kong-Request-Debug-Token')
      if (t?.value) return t.value
    }
    return null
  }, [topLevelFolder?.id, requests])

  // For dedicated CPs: fetch the existing KONG_REQUEST_DEBUG_TOKEN from the gateway config
  const [fetchedToken, setFetchedToken] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const generatedToken = useRef(String(Math.floor(100000 + Math.random() * 900000)))

  useEffect(() => {
    if (!isDedicated || isEnabled || isServerless) return
    const pat = storage.loadKonnectPat()
    const cpId = topLevelFolder?.id.replace('konnect-cp-', '') ?? ''
    const geo = extractGeo(topLevelFolder?.kongCpEndpoint)
    if (!pat || !cpId || !geo) return

    setFetching(true)
    fetchDedicatedCpDebugToken(pat, cpId, geo)
      .then(t => { if (t) setFetchedToken(t) })
      .finally(() => setFetching(false))
  }, [requestId])

  // Token priority: this request's own header → another CP request's token → fetched from gateway → folder stored → generated
  const token = existingTokenHeader?.value ?? cpTokenInUse ?? fetchedToken ?? topLevelFolder?.kongDebug?.token ?? generatedToken.current

  const tokenLockedByCp = !isEnabled && !!cpTokenInUse
  const tokenFromGateway = !isEnabled && !cpTokenInUse && !!fetchedToken

  if (!request || !topLevelFolder) return null

  function enable() {
    const filteredHeaders = request!.headers.filter(
      h => h.key !== 'X-Kong-Request-Debug' && h.key !== 'X-Kong-Request-Debug-Token'
    )
    updateRequest(requestId, {
      headers: [
        ...filteredHeaders,
        { id: uuid(), key: 'X-Kong-Request-Debug', value: '*', enabled: true },
        { id: uuid(), key: 'X-Kong-Request-Debug-Token', value: token, enabled: true },
      ],
    })
    updateFolder(topLevelFolder!.id, { kongDebug: { enabled: true, token } })
    onClose()
  }

  function disable() {
    updateRequest(requestId, {
      headers: request!.headers.filter(
        h => h.key !== 'X-Kong-Request-Debug' && h.key !== 'X-Kong-Request-Debug-Token'
      ),
    })
    updateFolder(topLevelFolder!.id, { kongDebug: { enabled: false, token } })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-[520px] rounded-lg shadow-2xl flex flex-col"
        style={{ background: '#111111', border: '1px solid #2a2a2a' }}>

        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#1a1a1a' }}>
          <BugAntIcon className="w-4 h-4 flex-shrink-0" style={{ color: NEON }} />
          <span className="font-semibold text-sm text-gray-200">Request Debugging</span>
          <span className="text-xs text-gray-600 ml-1">— {request.name}</span>
          <div className="flex-1" />
          <button className="btn-ghost p-1" onClick={onClose}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5 text-sm">

          {isServerless ? (
            <div className="flex items-start gap-3 p-3 rounded text-xs"
              style={{ background: '#1a1200', border: '1px solid #3a2a00', color: '#f59e0b' }}>
              <span className="mt-0.5">⚠</span>
              <span>
                Debugging headers are not supported for serverless control planes.
                The <code className="font-mono">X-Kong-Request-Debug</code> header
                can only be used with hybrid or dedicated cloud gateway data planes.
              </span>
            </div>
          ) : (
            <>
              {/* Headers block */}
              <div>
                <p className="text-xs text-gray-400 mb-3">
                  {isEnabled
                    ? 'Debugging is currently enabled. The following headers are present on this request:'
                    : 'Enabling debugging will add these headers to this request:'}
                </p>
                <div className="rounded font-mono text-xs space-y-1.5 p-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  <div className="flex gap-3">
                    <span className="text-gray-500 flex-shrink-0">X-Kong-Request-Debug</span>
                    <span style={{ color: NEON }}>*</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="text-gray-500 flex-shrink-0">X-Kong-Request-Debug-Token</span>
                    {fetching
                      ? <span className="text-gray-600 italic">fetching…</span>
                      : <span style={{ color: NEON }}>{token}</span>
                    }
                  </div>
                </div>
                {tokenLockedByCp && (
                  <p className="mt-2 text-xs text-gray-500">
                    This token is already in use by another request in this control plane.
                    Only one token can be set per data plane.
                  </p>
                )}
                {tokenFromGateway && (
                  <p className="mt-2 text-xs" style={{ color: '#6fdc0e99' }}>
                    Token pre-filled from your Dedicated Cloud Gateway configuration.
                  </p>
                )}
              </div>

              {/* Data Plane setup — only show when enabling for the first time */}
              {!tokenLockedByCp && !isEnabled && (
                <div>
                  <p className="text-xs font-medium text-gray-300 mb-2">
                    {tokenFromGateway
                      ? 'Confirm the environment variable is set on your Data Plane:'
                      : 'Set the following environment variable on your Data Plane:'}
                  </p>
                  <div className="rounded font-mono text-xs p-3 flex items-center gap-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                    <span className="text-gray-500">KONG_REQUEST_DEBUG_TOKEN</span>
                    {fetching
                      ? <span className="text-gray-600 italic">fetching…</span>
                      : <span style={{ color: NEON }}>{token}</span>
                    }
                  </div>

                  <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                    {isDedicated ? (
                      <>
                        For Dedicated Cloud Gateways, set environment variables through the Konnect UI.{' '}
                        <a
                          href="https://developer.konghq.com/dedicated-cloud-gateways/reference/#how-do-i-set-environment-variables"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                          style={{ color: NEON }}
                        >
                          See documentation →
                        </a>
                      </>
                    ) : (
                      <>
                        For hybrid Data Planes, set environment variables using your operating system's
                        standard mechanism (e.g. <code className="font-mono text-gray-300">export</code> in
                        your shell profile, a <code className="font-mono text-gray-300">.env</code> file,
                        or your service manager's environment configuration).
                      </>
                    )}
                  </div>
                </div>
              )}

              {isEnabled && (
                <div className="flex items-center gap-2 text-xs" style={{ color: NEON }}>
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                  Debugging is active — the Kong tab will appear in the response viewer.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isServerless && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: '#1a1a1a' }}>
            {isEnabled ? (
              <>
                <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
                <button className="text-xs px-3 py-1.5 rounded transition-colors"
                  style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', color: '#f87171' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2a0a0a')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1a0a0a')}
                  onClick={disable}>
                  Disable Debugging
                </button>
              </>
            ) : (
              <>
                <button className="btn-secondary text-xs" onClick={onClose}>Cancel</button>
                <button className="btn-primary text-xs flex items-center gap-1.5" disabled={fetching} onClick={enable}>
                  <BugAntIcon className="w-3.5 h-3.5" />
                  Enable Debugging
                </button>
              </>
            )}
          </div>
        )}
        {isServerless && (
          <div className="flex justify-end px-5 py-4 border-t" style={{ borderColor: '#1a1a1a' }}>
            <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
