import {copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import provenance from './build-info.cjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function listFiles(directory, prefix = '') {
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`Symbolic links are not build inputs: ${directory}`);
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const relative = prefix + entry.name;
    if (entry.name.startsWith('.')) throw new Error(`Hidden files are not build inputs: ${relative}`);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not build inputs: ${relative}`);
    if (entry.isDirectory()) return listFiles(path.join(directory, entry.name), relative + '/');
    if (!entry.isFile()) throw new Error(`Not a regular build input: ${relative}`);
    return [relative];
  }).sort();
}

// No transpiler, bundler, URL rewriting, generated timestamps, or minification.
// src/ and public/ map to the same deployment root without changing file bytes.
export function buildWeb(root = ROOT, {metadata = root === ROOT} = {}) {
  const inputs = new Map();
  for (const directory of ['src', 'public']) {
    for (const relative of listFiles(path.join(root, directory))) {
      if (inputs.has(relative)) throw new Error(`Duplicate output path in src/ and public/: ${relative}`);
      inputs.set(relative, path.join(root, directory, relative));
    }
  }
  const names = [...inputs.keys()].sort();
  if (metadata) for (const name of provenance.GENERATED) {
    if (names.some(input => input === name || input.startsWith(name + '/'))) throw new Error('Reserved generated build path: ' + name);
  }
  // Validate Git/package provenance before removing an existing build.
  if (metadata) provenance.buildInfo(root);
  // Catch file/directory overlaps before cleaning a previous build.
  for (const relative of names) {
    let parent = path.posix.dirname(relative);
    while (parent !== '.') {
      if (inputs.has(parent)) throw new Error(`Conflicting output paths: ${parent} and ${relative}`);
      parent = path.posix.dirname(parent);
    }
  }
  const output = path.join(root, 'dist');
  if (existsSync(output) && lstatSync(output).isSymbolicLink()) throw new Error('Refusing a symbolic-link dist directory');
  rmSync(output, {recursive: true, force: true});
  mkdirSync(output, {recursive: true});
  for (const relative of names) {
    const destination = path.join(output, relative);
    mkdirSync(path.dirname(destination), {recursive: true});
    copyFileSync(inputs.get(relative), destination);
  }
  if (metadata) provenance.writeGenerated(root);
  console.log(`Built ${names.length} approved files into dist/ (byte-for-byte copy)${metadata ? ' plus 2 provenance files' : ''}.`);
  return metadata ? [...names, ...provenance.GENERATED].sort() : names;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildWeb();
