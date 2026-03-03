const VAR_REGEX = /\{\{(\w+)\}\}/g

export interface InterpolateResult {
  resolved: string
  unresolvedVars: string[]
}

export function interpolate(template: string, variables: Record<string, string>): InterpolateResult {
  const unresolvedVars: string[] = []
  const resolved = template.replace(VAR_REGEX, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return variables[name]
    }
    unresolvedVars.push(name)
    return match
  })
  return { resolved, unresolvedVars }
}

export function extractVarNames(template: string): string[] {
  const names: string[] = []
  let m: RegExpExecArray | null
  const re = /\{\{(\w+)\}\}/g
  while ((m = re.exec(template)) !== null) {
    names.push(m[1])
  }
  return names
}

/** Highlights {{var}} spans in text — returns array of {text, isVar, resolved, name} segments */
export type Segment = { text: string; isVar: boolean; name?: string; resolved?: string; unresolved?: boolean }

export function segmentize(template: string, variables: Record<string, string>): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  const re = /\{\{(\w+)\}\}/g
  while ((m = re.exec(template)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: template.slice(lastIndex, m.index), isVar: false })
    }
    const name = m[1]
    const value = variables[name]
    segments.push({ text: m[0], isVar: true, name, resolved: value, unresolved: value === undefined })
    lastIndex = re.lastIndex
  }
  if (lastIndex < template.length) {
    segments.push({ text: template.slice(lastIndex), isVar: false })
  }
  return segments
}
