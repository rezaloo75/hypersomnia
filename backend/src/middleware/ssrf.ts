import { createConnection } from 'net'
import { resolve as dnsResolve } from 'dns/promises'

// Block private/loopback/link-local ranges
const BLOCKED_CIDRS = [
  // Loopback
  { start: ip2num('127.0.0.0'), end: ip2num('127.255.255.255') },
  // Private RFC1918
  { start: ip2num('10.0.0.0'), end: ip2num('10.255.255.255') },
  { start: ip2num('172.16.0.0'), end: ip2num('172.31.255.255') },
  { start: ip2num('192.168.0.0'), end: ip2num('192.168.255.255') },
  // Link-local (AWS metadata etc)
  { start: ip2num('169.254.0.0'), end: ip2num('169.254.255.255') },
  // IPv4-mapped IPv6
  { start: ip2num('0.0.0.0'), end: ip2num('0.255.255.255') },
]

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
])

function ip2num(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function isBlockedIp(ip: string): boolean {
  // Skip IPv6 checks for now (allow if IPv6)
  if (ip.includes(':')) return false
  try {
    const num = ip2num(ip)
    return BLOCKED_CIDRS.some(r => num >= r.start && num <= r.end)
  } catch {
    return true
  }
}

export async function checkSsrf(urlStr: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error('Invalid URL')
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocol "${parsed.protocol}" is not allowed`)
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block explicit blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Host "${hostname}" is not allowed`)
  }

  // If hostname is already an IP, check directly
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error(`IP address "${hostname}" is in a blocked range`)
    }
    return
  }

  // Resolve hostname and check all resulting IPs
  try {
    const addresses = await dnsResolve(hostname)
    for (const addr of addresses) {
      if (isBlockedIp(addr)) {
        throw new Error(`Host "${hostname}" resolves to a blocked IP address`)
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Host')) throw err
    // DNS resolution failure — block to be safe
    throw new Error(`Cannot resolve host "${hostname}"`)
  }
}
