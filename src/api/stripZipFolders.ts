import { isExcludedDownloadFolder } from '../wizard/defaults'

const SIG_EOCD = 0x06054b50
const SIG_CD = 0x02014b50
const SIG_LOCAL = 0x04034b50
const SIG_DD = 0x08074b50
const ZIP64 = 0xffffffff

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function decoder(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

function findEocd(buf: Uint8Array, view: DataView): number {
  const min = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= min; i--) {
    if (u32(view, i) !== SIG_EOCD) continue
    const commentLen = u16(view, i + 20)
    if (i + 22 + commentLen === buf.length) return i
  }
  throw new Error('ZIP end-of-central-directory not found')
}

function localRecordLength(view: DataView, offset: number, compressedSize: number, flags: number): number {
  if (u32(view, offset) !== SIG_LOCAL) {
    throw new Error('ZIP local header missing')
  }
  const nameLen = u16(view, offset + 26)
  const extraLen = u16(view, offset + 28)
  let length = 30 + nameLen + extraLen + compressedSize
  if (flags & 0x8) {
    const desc = offset + length
    length += u32(view, desc) === SIG_DD ? 16 : 12
  }
  return length
}

/**
 * Drops blink_demo / blink_backend / blink-backend from a workspace zip without
 * decompressing entries. Used so an older Render API still yields a clean download.
 */
export async function stripExcludedZipFolders(blob: Blob): Promise<{ blob: Blob; removed: number }> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  if (buf.byteLength < 22) return { blob, removed: 0 }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  try {
    const eocd = findEocd(buf, view)
    const cdCount = u16(view, eocd + 10)
    const cdSize = u32(view, eocd + 12)
    const cdOffset = u32(view, eocd + 16)
    if (cdCount === 0xffff || cdSize === ZIP64 || cdOffset === ZIP64) {
      return { blob, removed: 0 }
    }

    type Kept = { cd: Uint8Array; local: Uint8Array }
    const kept: Kept[] = []
    let cursor = cdOffset
    let removed = 0

    for (let i = 0; i < cdCount; i++) {
      if (u32(view, cursor) !== SIG_CD) throw new Error('ZIP central directory corrupted')
      const flags = u16(view, cursor + 8)
      const compressed = u32(view, cursor + 20)
      const nameLen = u16(view, cursor + 28)
      const extraLen = u16(view, cursor + 30)
      const commentLen = u16(view, cursor + 32)
      const localOffset = u32(view, cursor + 42)
      const cdLen = 46 + nameLen + extraLen + commentLen
      const name = decoder(buf.subarray(cursor + 46, cursor + 46 + nameLen))
      if (compressed === ZIP64 || localOffset === ZIP64) return { blob, removed: 0 }

      if (isExcludedDownloadFolder(name)) {
        removed += 1
        cursor += cdLen
        continue
      }

      const localLen = localRecordLength(view, localOffset, compressed, flags)
      kept.push({
        cd: buf.subarray(cursor, cursor + cdLen),
        local: buf.subarray(localOffset, localOffset + localLen),
      })
      cursor += cdLen
    }

    if (removed === 0) return { blob, removed: 0 }

    const commentLen = u16(view, eocd + 20)
    const comment = buf.subarray(eocd + 22, eocd + 22 + commentLen)
    let localBytes = 0
    let cdBytes = 0
    for (const entry of kept) {
      localBytes += entry.local.byteLength
      cdBytes += entry.cd.byteLength
    }
    const out = new Uint8Array(localBytes + cdBytes + 22 + comment.byteLength)
    const outView = new DataView(out.buffer)
    let localPos = 0
    let cdPos = localBytes

    for (const entry of kept) {
      out.set(entry.local, localPos)
      out.set(entry.cd, cdPos)
      writeU32(outView, cdPos + 42, localPos)
      localPos += entry.local.byteLength
      cdPos += entry.cd.byteLength
    }

    const eocdPos = localBytes + cdBytes
    out.set(buf.subarray(eocd, eocd + 22), eocdPos)
    writeU16(outView, eocdPos + 8, kept.length)
    writeU16(outView, eocdPos + 10, kept.length)
    writeU32(outView, eocdPos + 12, cdBytes)
    writeU32(outView, eocdPos + 16, localBytes)
    if (comment.byteLength) out.set(comment, eocdPos + 22)

    return { blob: new Blob([out], { type: blob.type || 'application/zip' }), removed }
  } catch {
    return { blob, removed: 0 }
  }
}
