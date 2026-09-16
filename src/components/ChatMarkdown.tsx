import type { ReactNode } from 'react'

/** Lightweight Markdown → React for Blink Chat replies (safe text nodes only). */
export function ChatMarkdown({ text }: { text: string }) {
  const blocks = splitBlocks(text)
  return (
    <div className="chat-md">
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <pre key={i} className="chat-md-pre">
              <code>{block.value}</code>
            </pre>
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="chat-md-ul">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="chat-md-ol">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.type === 'h') {
          const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3')
          return (
            <Tag key={i} className={`chat-md-h chat-md-h${block.level}`}>
              {renderInline(block.value)}
            </Tag>
          )
        }
        return (
          <p key={i} className="chat-md-p">
            {renderInline(block.value)}
          </p>
        )
      })}
    </div>
  )
}

type Block =
  | { type: 'p'; value: string }
  | { type: 'h'; level: 1 | 2 | 3; value: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; value: string }

function splitBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      out.push({ type: 'code', value: body.join('\n') })
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      out.push({ type: 'h', level: heading[1].length as 1 | 2 | 3, value: heading[2] })
      i += 1
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i += 1
      }
      out.push({ type: 'ul', items })
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i += 1
      }
      out.push({ type: 'ol', items })
      continue
    }
    if (!line.trim()) {
      i += 1
      continue
    }
    const para: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !/^(#{1,3})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    out.push({ type: 'p', value: para.join(' ') })
  }
  return out.length ? out : [{ type: 'p', value: '' }]
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Inline code, bold, italic, links — applied left-to-right without nesting explosions.
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key++} className="chat-md-code">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (m && isSafeHref(m[2])) {
        nodes.push(
          <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    } else {
      nodes.push(token)
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim())
}
