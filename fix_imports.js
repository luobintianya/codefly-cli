/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs';
import path from 'node:path';

const exportsPath = '/Users/robinx/code/codefly-cli/exports.txt';
const errorsPath =
  '/Users/robinx/code/codefly-cli/packages/cli/typecheck_errors.txt';
const corePackage = '@codeflyai/codefly-core';

if (!fs.existsSync(exportsPath) || !fs.existsSync(errorsPath)) {
  console.error('Missing exports.txt or typecheck_errors.txt');
  process.exit(1);
}

const availableExports = new Set(
  fs
    .readFileSync(exportsPath, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s),
);

const errorLines = fs.readFileSync(errorsPath, 'utf8').split('\n');

const fileFixes = new Map();

for (const line of errorLines) {
  const match = line.match(
    /^([^(]+)\(\d+,\d+\): error TS2304: Cannot find name '(.*)'/,
  );
  if (!match) continue;

  const filePath = match[1].startsWith('/')
    ? match[1]
    : path.resolve('/Users/robinx/code/codefly-cli/packages/cli', match[1]);
  const name = match[2];

  if (availableExports.has(name)) {
    if (!fileFixes.has(filePath)) fileFixes.set(filePath, new Set());
    fileFixes.get(filePath).add(name);
  }
}

for (const [filePath, names] of fileFixes) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Look for existing import from core package
  const importRegex = new RegExp(
    `import\\s+\\{([^}]*)\\}\\s+from\\s+['"]${corePackage}['"]`,
    'g',
  );
  const typeImportRegex = new RegExp(
    `import\\s+type\\s+\\{([^}]*)\\}\\s+from\\s+['"]${corePackage}['"]`,
    'g',
  );

  let updated = false;

  // Try regular import first
  if (content.match(importRegex)) {
    content = content.replace(importRegex, (match, p1) => {
      const existingNames = p1
        .split(',')
        .map((s) => s.trim().split(' as ')[0])
        .filter((s) => s);
      const namesToAdd = Array.from(names).filter(
        (n) => !existingNames.includes(n),
      );
      if (namesToAdd.length === 0) return match;
      updated = true;
      const newNames = [
        ...p1
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s),
        ...namesToAdd,
      ].sort();
      return `import { ${newNames.join(', ')} } from '${corePackage}'`;
    });
  } else if (content.match(typeImportRegex)) {
    // Try type import
    content = content.replace(typeImportRegex, (match, p1) => {
      const existingNames = p1
        .split(',')
        .map((s) => s.trim().split(' as ')[0])
        .filter((s) => s);
      const namesToAdd = Array.from(names).filter(
        (n) => !existingNames.includes(n),
      );
      if (namesToAdd.length === 0) return match;
      updated = true;
      const newNames = [
        ...p1
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s),
        ...namesToAdd,
      ].sort();
      return `import type { ${newNames.join(', ')} } from '${corePackage}'`;
    });
  } else {
    // No existing import, add a new one after license or at top
    const namesToAdd = Array.from(names).sort();
    const newImport = `import { ${namesToAdd.join(', ')} } from '${corePackage}';\n`;
    const licenseMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (licenseMatch) {
      content = content.replace(
        licenseMatch[0],
        `${licenseMatch[0]}\n${newImport}`,
      );
    } else {
      content = `${newImport}${content}`;
    }
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated imports in: ${filePath}`);
  }
}
