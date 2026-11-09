/**
 * The halo-file:// codec: every URL a producer builds must be a valid URL
 * with an empty host (a Windows drive letter as host is exactly the silent
 * blank-image bug of #436) and must decode back to the original path.
 */

import { describe, it, expect } from 'vitest'
import { toHaloFileUrl, toFileUrl, haloFileUrlToPath } from '../../../src/shared/halo-file-url'

describe('toHaloFileUrl', () => {
  it('keeps the host empty for a Windows drive path', () => {
    const url = toHaloFileUrl('C:\\Users\\me\\.halo\\spaces\\s1\\.halo\\conversations\\c1.images\\m1-img-1.png')
    expect(url).toBe('halo-file:///C%3A/Users/me/.halo/spaces/s1/.halo/conversations/c1.images/m1-img-1.png')
    const parsed = new URL(url)
    expect(parsed.host).toBe('')
    expect(parsed.protocol).toBe('halo-file:')
  })

  it('keeps a POSIX path unchanged apart from encoding', () => {
    expect(toHaloFileUrl('/home/me/a b/图片.png')).toBe('halo-file:///home/me/a%20b/%E5%9B%BE%E7%89%87.png')
  })

  it('encodes characters with URL meaning inside file names', () => {
    const url = toHaloFileUrl('/tmp/a#b/c?d/%e.png')
    expect(url).toBe('halo-file:///tmp/a%23b/c%3Fd/%25e.png')
    expect(haloFileUrlToPath(url)).toBe('/tmp/a#b/c?d/%e.png')
  })

  it('preserves a trailing slash (directory base URLs)', () => {
    expect(toHaloFileUrl('C:\\dir\\site\\')).toBe('halo-file:///C%3A/dir/site/')
    expect(toHaloFileUrl('/srv/site/')).toBe('halo-file:///srv/site/')
  })

  it('produces URLs Chromium accepts for every platform path shape', () => {
    for (const path of ['C:\\a\\b.png', '/a/b.png', 'D:\\截图\\消息 01.png']) {
      expect(() => new URL(toHaloFileUrl(path))).not.toThrow()
      expect(new URL(toHaloFileUrl(path)).host).toBe('')
    }
  })
})

describe('toFileUrl', () => {
  it('keeps the host empty for a Windows drive path', () => {
    const url = toFileUrl('C:\\spaces\\s1\\Li,Yi 李祎-合同 (1).pdf')
    expect(url).toBe('file:///C%3A/spaces/s1/Li%2CYi%20%E6%9D%8E%E7%A5%8E-%E5%90%88%E5%90%8C%20(1).pdf')
    const parsed = new URL(url)
    expect(parsed.host).toBe('')
    expect(parsed.protocol).toBe('file:')
  })

  it('keeps a POSIX path unchanged apart from encoding', () => {
    expect(toFileUrl('/home/me/a b/图片.pdf')).toBe('file:///home/me/a%20b/%E5%9B%BE%E7%89%87.pdf')
  })

  it('encodes characters with URL meaning inside file names', () => {
    expect(toFileUrl('/tmp/a#b/c?d.pdf')).toBe('file:///tmp/a%23b/c%3Fd.pdf')
  })

  it('produces URLs Chromium accepts for every platform path shape', () => {
    for (const path of ['C:\\a\\b.pdf', '/a/b.pdf', 'D:\\截图\\消息 01.pdf']) {
      expect(() => new URL(toFileUrl(path))).not.toThrow()
      expect(new URL(toFileUrl(path)).host).toBe('')
    }
  })

  it('survives the inline form that left canvas PDF tabs blank on Windows', () => {
    // `file://` + a raw Windows path makes the drive letter the host and the
    // escaped backslashes an invalid port, so the URL never parsed and the
    // guest stayed on about:blank with nothing to show.
    const windowsPath = 'C:\\Users\\me\\a#b.pdf'
    expect(() => new URL(`file://${encodeURI(windowsPath)}`)).toThrow()
    expect(() => new URL(toFileUrl(windowsPath))).not.toThrow()
  })
})

describe('haloFileUrlToPath', () => {
  it('round-trips a Windows path to forward slashes', () => {
    expect(haloFileUrlToPath(toHaloFileUrl('C:\\x\\y z\\i.png'))).toBe('/C:/x/y z/i.png')
  })

  it('drops the renderer cache-buster query and hash', () => {
    expect(haloFileUrlToPath('halo-file:///C%3A/x/i.png?v=3#frag')).toBe('/C:/x/i.png')
  })

  it('accepts a bare path when the scheme is already stripped', () => {
    expect(haloFileUrlToPath('/C%3A/x/i.png')).toBe('/C:/x/i.png')
  })
})
