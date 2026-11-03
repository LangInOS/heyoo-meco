# Notice

## Upstream

Meco is a downstream distribution of [Halo](https://github.com/openkursar/hello-halo),
an open-source desktop AI workstation by OpenKursar.

Halo is licensed under the MIT License, reproduced unmodified in the `LICENSE`
file at the root of this repository:

    Copyright (c) 2024-2025 OpenKursar

## Meco modifications

Copyright (c) 2025 Meco Team

The modifications and additions made by the Meco Team on top of the software
described above are licensed under the MIT License:

    MIT License

    Copyright (c) 2025 Meco Team

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

## Third-party components

This distribution bundles third-party software. Each component remains under its
own license; its terms travel with the component.

| Component | Version | License |
| --- | --- | --- |
| Electron | 43.7.7 | MIT |
| `@deepseek-ai/*` — the `dsh` engine runtime (deepseek-harness) | 0.2.0-rc.2 | MIT (2 packages BSD-3-Clause) |
| `@anthropic-ai/claude-code` | 2.1.89 | See `LICENSE IN README.md` in the package |
| `@openai/codex` | 0.128.0 | Apache-2.0 |
| `tesseract.js` | 5.1.1 | Apache-2.0 |
| `sharp` | 0.35.5 | Apache-2.0 |
| `cloudflared` | 0.7.1 | MIT |
| `better-sqlite3` | 13.0.3 | MIT |
| `node-pty` | 1.1.0 | MIT |
| `@parcel/watcher` | 2.5.6 | MIT |
| `koffi` | 3.1.1 | MIT |
| `@vscode/ripgrep` | 1.18.0 | MIT |
| PortableGit (git-for-windows) | 2.47.1 | GPL-2.0 |
| `resources/office-runtime` bundled modules | — | MIT, ISC, BSD, Apache-2.0, others |

PortableGit ships as a standalone, separately-invoked program. It is not linked
into Meco and does not extend its license to this codebase.
