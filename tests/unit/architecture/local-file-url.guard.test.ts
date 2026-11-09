/**
 * A local file reaches Chromium as a `file://` URL, and a path interpolated
 * straight into one is not a URL on Windows: the drive letter becomes the host,
 * the escaped backslashes an invalid port, and Chromium drops the load before
 * anything renders. Canvas PDF and HTML tabs were blank for exactly this.
 * `toFileUrl` is the one encoder, so no caller may build the URL itself.
 *
 * Scoped to the renderer, where the fix landed. The `halo-file://` handler in
 * `main/foundation/protocol.service.ts` still interpolates a decoded path and
 * loses the tail of any name holding '#' or '?'; it is a separate defect with a
 * wider blast radius and is not covered here.
 */

import { describe, it, expect } from 'vitest'
import { findMatches, formatMatches, listSourceFiles } from './lib/source-scan'

/** A template literal or concatenation that splices a path into `file://`. */
const INTERPOLATED = [/`file:\/\/\$\{/, /['"]file:\/\/['"]\s*\+/]

describe('local file URLs', () => {
  it('are built by the shared codec, never by interpolating a path', () => {
    const offenders = listSourceFiles('src/renderer').flatMap((file) =>
      INTERPOLATED.flatMap((pattern) => findMatches([file], pattern))
    )
    expect(offenders, formatMatches(offenders)).toEqual([])
  })
})
