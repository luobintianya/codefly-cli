/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs';
import path from 'node:path';

const indexPath = '/Users/robinx/code/codefly-cli/packages/core/src/index.ts';
const content = fs.readFileSync(indexPath, 'utf8');
const exportLines = content
  .split('\n')
  .filter((line) => line.includes('export * from'));
const exportedFiles = exportLines
  .map((line) => {
    const match = line.match(/from '(.*)'/);
    return match ? match[1] : null;
  })
  .filter((f) => f);

const allExports = new Set();

for (const f of exportedFiles) {
  const absPath = path.resolve(
    path.dirname(indexPath),
    f.replace('.js', '.ts'),
  );
  if (fs.existsSync(absPath)) {
    const fileContent = fs.readFileSync(absPath, 'utf8');
    const matches = fileContent.matchAll(
      /export (const|function|enum|class|type|interface) (\w+)/g,
    );
    for (const m of matches) {
      allExports.add(m[2]);
    }
  }
}

// Also check individual exports in index.ts
const matches = content.matchAll(/export \{(.*)\} from/g);
for (const m of matches) {
  const items = m[1].split(',').map((i) => i.split(' as ').pop().trim());
  for (const item of items) {
    if (item) allExports.add(item);
  }
}

console.log(Array.from(allExports).join('\n'));
