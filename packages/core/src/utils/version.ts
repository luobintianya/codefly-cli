/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPackageJson } from './package.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let versionCache: string | undefined;

export async function getVersion(): Promise<string> {
  if (process.env['CLI_VERSION']) {
    return process.env['CLI_VERSION'];
  }
  if (versionCache) {
    return versionCache;
  }
  const pkgJson = await getPackageJson(__dirname);
  versionCache = pkgJson?.version || 'unknown';
  return versionCache;
}

export function resetVersionCache(): void {
  versionCache = undefined;
}
