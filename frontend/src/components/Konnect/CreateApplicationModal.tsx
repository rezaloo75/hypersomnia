import { useState, useEffect } from 'react'
import {
  XMarkIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { storage } from '../../db/storage'
import {
  listPortalAuthStrategies,
  createPortalApplication,
  createAppCredential,
  createAppRegistration,
  listApiVersions,
  type KonnectRegion,
  type KonnectAuthStrategy,
  type KonnectPortalApi,
  type KonnectApiVersion,
  type KonnectCreateAppResponse,
} from '../../utils/konnectApi'

const NEON = '#6fdc0e'

interface PortalInfo {
  id: string
  name: string
}

interface Props {
  portals: PortalInfo[]
  matchedApis: KonnectPortalApi[]
  region: KonnectRegion
  onClose: () => void
  onCreated: () => void
}

type Step = 'details' | 'register' | 'credentials'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
      <div className="flex items-center gap-1" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 4, padding: '6px 8px' }}>
        <code style={{ flex: 1, fontSize: 11, color: NEON, wordBreak: 'break-all', fontFamily: 'ui-monospace,SFMono-Regular,monospace' }}>
          {value}
        </code>
        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: 4, flexShrink: 0,
            background: copied ? 'rgba(111,220,14,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? 'rgba(111,220,14,0.3)' : '#2a2a2a'}`,
            color: copied ? NEON : '#6b7280',
            cursor: 'pointer',
          }}
          title="Copy"
        >
          {copied ? <CheckIcon className="w-3 h-3" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
        </button>
      </div>
    </div>
  )
}

export function CreateApplicationModal({ portals, matchedApis, region, onClose, onCreated }: Props) {
  const pat = storage.loadKonnectPat() ?? ''

  // Step tracking
  const [step, setStep] = useState<Step>('details')

  // Step 1: Details
  const [selectedPortalId, setSelectedPortalId] = useState(portals[0]?.id ?? '')
  const [appName, setAppName] = useState('')
  const [appDescription, setAppDescription] = useState('')
  const [authStrategies, setAuthStrategies] = useState<KonnectAuthStrategy[]>([])
  const [selectedAuthStrategy, setSelectedAuthStrategy] = useState('')
  const [loadingStrategies, setLoadingStrategies] = useState(false)

  // Step 2: Register for API
  const [selectedApiId, setSelectedApiId] = useState('')
  const [apiVersions, setApiVersions] = useState<KonnectApiVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Result
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdApp, setCreatedApp] = useState<KonnectCreateAppResponse | null>(null)
  const [credential, setCredential] = useState<Record<string, unknown> | null>(null)
  const [registrationResult, setRegistrationResult] = useState<Record<string, unknown> | null>(null)

  // Load auth strategies when portal changes
  useEffect(() => {
    if (!selectedPortalId || !pat) return
    setLoadingStrategies(true)
    listPortalAuthStrategies(pat, region, selectedPortalId)
      .then(strategies => {
        setAuthStrategies(strategies)
        if (strategies.length === 1) setSelectedAuthStrategy(strategies[0].id)
        else setSelectedAuthStrategy('')
      })
      .finally(() => setLoadingStrategies(false))
  }, [selectedPortalId, pat, region])

  // Load API versions when API is selected
  useEffect(() => {
    if (!selectedApiId || !pat) return
    setLoadingVersions(true)
    listApiVersions(pat, region, selectedApiId)
      .then(versions => {
        setApiVersions(versions)
        // Auto-select the first published version, or just the first
        const published = versions.find(v => v.publish_status === 'published')
        setSelectedVersionId(published?.id ?? versions[0]?.id ?? '')
      })
      .finally(() => setLoadingVersions(false))
  }, [selectedApiId, pat, region])

  // Auto-select first API if only one
  useEffect(() => {
    if (matchedApis.length === 1) setSelectedApiId(matchedApis[0].id)
  }, [matchedApis])

  async function handleCreate() {
    if (!appName.trim() || !selectedPortalId) return
    setCreating(true)
    setError(null)
    try {
      const payload: { name: string; description?: string; auth_strategy_id?: string } = { name: appName.trim() }
      if (appDescription.trim()) payload.description = appDescription.trim()
      if (selectedAuthStrategy) payload.auth_strategy_id = selectedAuthStrategy

      const app = await createPortalApplication(pat, region, selectedPortalId, payload)
      setCreatedApp(app)

      // If response includes credentials directly, capture them
      if (app.credentials) {
        setCredential(app.credentials as unknown as Record<string, unknown>)
      }

      // If an API + version is selected, register the app
      if (selectedApiId && selectedVersionId && app.id) {
        try {
          const reg = await createAppRegistration(pat, region, selectedPortalId, app.id, {
            api_product_version_id: selectedVersionId,
          })
          setRegistrationResult(reg)
        } catch (regErr) {
          // Registration failed but app was created — still show credentials
          console.warn('[konnect] registration failed:', regErr)
        }
      }

      // If no credentials in response, create one explicitly
      if (!app.credentials && app.id) {
        try {
          const cred = await createAppCredential(pat, region, selectedPortalId, app.id)
          setCredential(cred)
        } catch (credErr) {
          console.warn('[konnect] credential creation failed:', credErr)
        }
      }

      setStep('credentials')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application')
    } finally {
      setCreating(false)
    }
  }

  const canProceedToRegister = appName.trim().length > 0
  const selectedPortal = portals.find(p => p.id === selectedPortalId)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{
          width: 480,
          maxHeight: '80vh',
          background: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#1e1e1e' }}>
          <PlusIcon className="w-4 h-4 flex-shrink-0" style={{ color: NEON }} />
          <span className="text-sm font-semibold text-gray-200 flex-1">
            {step === 'details' && 'Create Application'}
            {step === 'register' && 'Register for API'}
            {step === 'credentials' && 'Application Created'}
          </span>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {(['details', 'register', 'credentials'] as Step[]).map((s, i) => (
              <div
                key={s}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: step === s ? NEON : s === 'credentials' && step !== 'credentials' ? '#2a2a2a' : '#3a3a3a',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          <button className="btn-ghost p-1 ml-1" onClick={onClose}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ minHeight: 200 }}>

          {/* ── Step 1: Application Details ── */}
          {step === 'details' && (
            <div className="space-y-4">
              {/* Portal selector */}
              {portals.length > 1 && (
                <div>
                  <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Portal
                  </label>
                  <select
                    className="input-base w-full"
                    value={selectedPortalId}
                    onChange={e => setSelectedPortalId(e.target.value)}
                    style={{ fontSize: 12 }}
                  >
                    {portals.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {portals.length === 1 && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  Portal: <span style={{ color: '#d1d5db' }}>{portals[0].name}</span>
                </div>
              )}

              {/* App name */}
              <div>
                <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Application Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  className="input-base w-full"
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  placeholder="e.g. My Test App"
                  maxLength={255}
                  autoFocus
                  style={{ fontSize: 12 }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Description
                </label>
                <input
                  className="input-base w-full"
                  value={appDescription}
                  onChange={e => setAppDescription(e.target.value)}
                  placeholder="Optional description"
                  maxLength={255}
                  style={{ fontSize: 12 }}
                />
              </div>

              {/* Auth strategy */}
              <div>
                <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Auth Strategy
                </label>
                {loadingStrategies ? (
                  <div className="flex items-center gap-1.5 text-gray-600" style={{ fontSize: 11 }}>
                    <ArrowPathIcon className="w-3 h-3 animate-spin" />Loading...
                  </div>
                ) : authStrategies.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>No auth strategies available</div>
                ) : (
                  <select
                    className="input-base w-full"
                    value={selectedAuthStrategy}
                    onChange={e => setSelectedAuthStrategy(e.target.value)}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">Select strategy...</option>
                    {authStrategies.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.credential_type ? ` (${s.credential_type})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Register for API ── */}
          {step === 'register' && (
            <div className="space-y-4">
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                Optionally register this application for an API to obtain access.
              </div>

              {/* API selector */}
              <div>
                <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  API
                </label>
                {matchedApis.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>No APIs linked to this service.</div>
                ) : (
                  <select
                    className="input-base w-full"
                    value={selectedApiId}
                    onChange={e => { setSelectedApiId(e.target.value); setSelectedVersionId('') }}
                    style={{ fontSize: 12 }}
                  >
                    {matchedApis.length > 1 && <option value="">Select API...</option>}
                    {matchedApis.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Version selector */}
              {selectedApiId && (
                <div>
                  <label style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    API Version
                  </label>
                  {loadingVersions ? (
                    <div className="flex items-center gap-1.5 text-gray-600" style={{ fontSize: 11 }}>
                      <ArrowPathIcon className="w-3 h-3 animate-spin" />Loading...
                    </div>
                  ) : apiVersions.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>No versions found.</div>
                  ) : (
                    <select
                      className="input-base w-full"
                      value={selectedVersionId}
                      onChange={e => setSelectedVersionId(e.target.value)}
                      style={{ fontSize: 12 }}
                    >
                      {apiVersions.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name ?? v.id}
                          {v.publish_status ? ` (${v.publish_status})` : ''}
                          {v.deprecated ? ' [deprecated]' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Summary */}
              <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 4, padding: '8px 10px', marginTop: 8 }}>
                <div style={{ fontSize: 9, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
                  Summary
                </div>
                <div style={{ fontSize: 11, color: '#d1d5db' }}>
                  <div>App: <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{appName}</span></div>
                  <div>Portal: <span style={{ color: '#e5e7eb' }}>{selectedPortal?.name ?? '—'}</span></div>
                  {selectedApiId && (
                    <div>API: <span style={{ color: '#e5e7eb' }}>{matchedApis.find(a => a.id === selectedApiId)?.name ?? '—'}</span>
                      {selectedVersionId && apiVersions.length > 0 && (
                        <span style={{ color: '#9ca3af' }}> / {apiVersions.find(v => v.id === selectedVersionId)?.name ?? ''}</span>
                      )}
                    </div>
                  )}
                  {selectedAuthStrategy && authStrategies.length > 0 && (
                    <div>Auth: <span style={{ color: '#e5e7eb' }}>{authStrategies.find(s => s.id === selectedAuthStrategy)?.name ?? '—'}</span></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Credentials ── */}
          {step === 'credentials' && (
            <div>
              {/* Success banner */}
              <div className="flex items-start gap-2 mb-4 p-3 rounded" style={{ background: 'rgba(111,220,14,0.06)', border: '1px solid rgba(111,220,14,0.15)' }}>
                <CheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: NEON }} />
                <div>
                  <div style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600 }}>
                    {createdApp?.name} created successfully
                  </div>
                  {registrationResult && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                      Registered for {matchedApis.find(a => a.id === selectedApiId)?.name ?? 'API'}
                    </div>
                  )}
                </div>
              </div>

              {/* Warning: ephemeral */}
              <div className="flex items-start gap-2 mb-4 p-3 rounded" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <div style={{ fontSize: 10, color: '#f59e0b' }}>
                  Copy your credentials now. They will not be shown again after closing this dialog.
                </div>
              </div>

              {/* Credential fields */}
              {credential && (() => {
                const key = credential.key as string | undefined
                const cred = credential.credential as string | undefined
                const clientId = credential.client_id as string | undefined
                const clientSecret = credential.client_secret as string | undefined
                const credId = credential.id as string | undefined
                const hasKnown = !!(key || cred || clientId)
                return (
                  <div>
                    {(key || cred) && (
                      <CopyField label="API Key" value={String(key ?? cred)} />
                    )}
                    {clientId && <CopyField label="Client ID" value={clientId} />}
                    {clientSecret && <CopyField label="Client Secret" value={clientSecret} />}
                    {credId && <CopyField label="Credential ID" value={credId} />}
                    {!hasKnown && (
                      <div>
                        {Object.entries(credential).map(([k, v]) => (
                          v != null ? <CopyField key={k} label={k} value={String(v)} /> : null
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {!credential && (
                <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 16 }}>
                  No credentials were returned. You may need to generate them from the Konnect dashboard.
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 p-2 rounded" style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', color: '#f87171', fontSize: 11 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t flex-shrink-0" style={{ borderColor: '#1e1e1e' }}>
          {step === 'details' && (
            <>
              <button className="btn-secondary text-xs" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary text-xs"
                disabled={!canProceedToRegister}
                onClick={() => setStep('register')}
              >
                Next
              </button>
            </>
          )}
          {step === 'register' && (
            <>
              <button className="btn-secondary text-xs" onClick={() => setStep('details')}>Back</button>
              <button
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={creating}
                onClick={handleCreate}
              >
                {creating ? (
                  <><ArrowPathIcon className="w-3 h-3 animate-spin" />Creating...</>
                ) : (
                  <><PlusIcon className="w-3 h-3" />Create Application</>
                )}
              </button>
            </>
          )}
          {step === 'credentials' && (
            <button className="btn-primary text-xs" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  )
}
