import type { FileSystemTree } from "@webcontainer/api";

/**
 * Node.js wrapper scripts that use ShellJS for Unix command implementations.
 * ShellJS is battle-tested and provides reliable cross-platform behavior.
 *
 * These scripts require ShellJS to be installed in the WebContainer.
 */

/**
 * Grep - search for patterns in files using ShellJS.
 * Supports: -v (invert), -l (files only), -i (ignore case).
 */
const GREP_SCRIPT = `#!/usr/bin/env node
const shell = require('shelljs');

const args = process.argv.slice(2);
let options = '';
let pattern = null;
const files = [];

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-v') options += 'v';
  else if (arg === '-l') options += 'l';
  else if (arg === '-i') options += 'i';
  else if (arg.startsWith('-') && !arg.startsWith('--')) {
    // Handle combined flags like -vi
    options += arg.slice(1);
  }
  else if (pattern === null) pattern = arg;
  else files.push(arg);
}

if (!pattern || files.length === 0) {
  console.error('Usage: grep [OPTIONS] PATTERN FILE...');
  process.exit(2);
}

const result = shell.grep(options ? '-' + options : '', pattern, files);

if (result.code !== 0 && result.stderr) {
  console.error(result.stderr);
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}

process.exit(result.code);
`;

/**
 * Find - search for files in a directory hierarchy using ShellJS.
 */
const FIND_SCRIPT = `#!/usr/bin/env node
const shell = require('shelljs');
const path = require('path');

const args = process.argv.slice(2);
let startPaths = [];
let namePattern = null;
let typeFilter = null;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-name') {
    namePattern = args[++i];
  } else if (arg === '-type') {
    typeFilter = args[++i];
  } else if (!arg.startsWith('-')) {
    startPaths.push(arg);
  }
}

if (startPaths.length === 0) {
  startPaths = ['.'];
}

// Convert glob pattern to regex
function globToRegex(glob) {
  let regex = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') regex += '.*';
    else if (c === '?') regex += '.';
    else if ('.+^\${}|()\\\\'.includes(c)) regex += '\\\\' + c;
    else regex += c;
  }
  return new RegExp(regex + '$');
}

const nameRegex = namePattern ? globToRegex(namePattern) : null;

for (const startPath of startPaths) {
  const files = shell.find(startPath);

  for (const file of files) {
    // Apply name filter
    if (nameRegex && !nameRegex.test(path.basename(file))) {
      continue;
    }

    // Apply type filter
    if (typeFilter) {
      const stat = shell.test('-d', file) ? 'd' : 'f';
      if (typeFilter !== stat) continue;
    }

    console.log(file);
  }
}
`;

/**
 * Sed - stream editor using ShellJS.
 * Supports: -i (in-place), s/pattern/replacement/flags.
 */
const SED_SCRIPT = `#!/usr/bin/env node
const shell = require('shelljs');

const args = process.argv.slice(2);
let inPlace = false;
let script = null;
const files = [];

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-i') {
    inPlace = true;
  } else if (!arg.startsWith('-') && script === null) {
    script = arg;
  } else if (!arg.startsWith('-')) {
    files.push(arg);
  }
}

if (!script || files.length === 0) {
  console.error('Usage: sed [-i] SCRIPT FILE...');
  process.exit(1);
}

// Parse sed script (s/pattern/replacement/flags)
if (!script.startsWith('s')) {
  console.error('sed: only substitution commands (s/.../.../flags) are supported');
  process.exit(1);
}

const delimiter = script[1];
const parts = script.slice(2).split(delimiter);
if (parts.length < 2) {
  console.error('sed: invalid substitution command');
  process.exit(1);
}

const [pattern, replacement, flags = ''] = parts;
const options = inPlace ? '-i' : '';

const result = shell.sed(options, new RegExp(pattern, flags.includes('g') ? 'g' : ''), replacement, files);

if (result.code !== 0 && result.stderr) {
  console.error(result.stderr);
}

if (!inPlace && result.stdout) {
  process.stdout.write(result.stdout);
}

process.exit(result.code);
`;

/**
 * Cat - concatenate and display files using ShellJS.
 */
const CAT_SCRIPT = `#!/usr/bin/env node
const shell = require('shelljs');

const files = process.argv.slice(2);

if (files.length === 0) {
  // Read from stdin
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => process.stdout.write(input));
} else {
  const result = shell.cat(files);
  if (result.code !== 0 && result.stderr) {
    console.error(result.stderr);
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  process.exit(result.code);
}
`;

/**
 * Head - output the first part of files using ShellJS.
 */
const HEAD_SCRIPT = `#!/usr/bin/env node
const shell = require('shelljs');

const args = process.argv.slice(2);
let lines = 10;
const files = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-n') {
    lines = parseInt(args[++i], 10);
  } else if (arg.startsWith('-') && !isNaN(parseInt(arg.slice(1), 10))) {
    lines = parseInt(arg.slice(1), 10);
  } else {
    files.push(arg);
  }
}

if (files.length === 0) {
  console.error('Usage: head [-n LINES] FILE...');
  process.exit(1);
}

const result = shell.head({ '-n': lines }, files);
if (result.stdout) {
  process.stdout.write(result.stdout);
}
process.exit(result.code);
`;

/**
 * Tail - output the last part of files using ShellJS.
 */
const TAIL_SCRIPT = `#!/usr/bin/env node
const shell = require('shelljs');

const args = process.argv.slice(2);
let lines = 10;
const files = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-n') {
    lines = parseInt(args[++i], 10);
  } else if (arg.startsWith('-') && !isNaN(parseInt(arg.slice(1), 10))) {
    lines = parseInt(arg.slice(1), 10);
  } else {
    files.push(arg);
  }
}

if (files.length === 0) {
  console.error('Usage: tail [-n LINES] FILE...');
  process.exit(1);
}

const result = shell.tail({ '-n': lines }, files);
if (result.stdout) {
  process.stdout.write(result.stdout);
}
process.exit(result.code);
`;

/**
 * Wc - word, line, character count (custom implementation - not in ShellJS).
 */
const WC_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');

const args = process.argv.slice(2);
let countLines = false;
let countWords = false;
let countBytes = false;
const files = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-l') countLines = true;
  else if (arg === '-w') countWords = true;
  else if (arg === '-c') countBytes = true;
  else if (arg.startsWith('-')) {
    for (const c of arg.slice(1)) {
      if (c === 'l') countLines = true;
      else if (c === 'w') countWords = true;
      else if (c === 'c') countBytes = true;
    }
  } else {
    files.push(arg);
  }
}

if (!countLines && !countWords && !countBytes) {
  countLines = countWords = countBytes = true;
}

const totals = { lines: 0, words: 0, bytes: 0 };

function processContent(content, buffer, filename) {
  const lines = (content.match(/\\n/g) || []).length;
  const words = content.trim() ? content.trim().split(/\\s+/).length : 0;
  const bytes = buffer.length;

  totals.lines += lines;
  totals.words += words;
  totals.bytes += bytes;

  const parts = [];
  if (countLines) parts.push(lines.toString().padStart(8));
  if (countWords) parts.push(words.toString().padStart(8));
  if (countBytes) parts.push(bytes.toString().padStart(8));
  if (filename) parts.push(' ' + filename);
  console.log(parts.join(''));
}

if (files.length === 0) {
  let input = '';
  const chunks = [];
  process.stdin.on('data', chunk => { chunks.push(chunk); input += chunk; });
  process.stdin.on('end', () => {
    processContent(input, Buffer.concat(chunks), null);
  });
} else {
  for (const file of files) {
    try {
      const buffer = fs.readFileSync(file);
      processContent(buffer.toString('utf8'), buffer, file);
    } catch (e) {
      console.error('wc: ' + file + ': No such file or directory');
    }
  }
  if (files.length > 1) {
    const parts = [];
    if (countLines) parts.push(totals.lines.toString().padStart(8));
    if (countWords) parts.push(totals.words.toString().padStart(8));
    if (countBytes) parts.push(totals.bytes.toString().padStart(8));
    parts.push(' total');
    console.log(parts.join(''));
  }
}
`;

/**
 * Awk - pattern scanning and processing (simplified implementation - not in ShellJS).
 */
const AWK_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');

const args = process.argv.slice(2);
let fieldSeparator = /\\s+/;
let program = null;
const files = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-F') {
    const sep = args[++i];
    fieldSeparator = sep.length === 1 ? sep : new RegExp(sep);
  } else if (!arg.startsWith('-') && program === null) {
    program = arg;
  } else if (!arg.startsWith('-')) {
    files.push(arg);
  }
}

if (!program) {
  console.error('Usage: awk [-F sep] program [file...]');
  process.exit(1);
}

let NR = 0;
let fields = [];

function getField(n) {
  if (n === 0) return fields.join(typeof fieldSeparator === 'string' ? fieldSeparator : ' ');
  return fields[n - 1] || '';
}

function executeProgram(line) {
  NR++;
  fields = line.split(fieldSeparator);
  const NF = fields.length;

  // Simple parser for common awk patterns
  let prog = program.trim();

  // Handle {print} or {print $1, $2}
  const match = prog.match(/^\\{\\s*print\\s*(.*)\\}$/);
  if (match) {
    const expr = match[1].trim();
    if (!expr) {
      console.log(line);
    } else {
      const parts = expr.split(/,/).map(p => {
        p = p.trim();
        if (p.startsWith('$')) {
          const n = p === '$NF' ? NF : parseInt(p.slice(1), 10);
          return getField(n);
        }
        if (p.startsWith('"') && p.endsWith('"')) {
          return p.slice(1, -1);
        }
        return p;
      });
      console.log(parts.join(' '));
    }
    return;
  }

  // Handle /pattern/ {action}
  const patternMatch = prog.match(/^\\/(.+)\\/\\s*\\{(.+)\\}$/);
  if (patternMatch) {
    const [, pattern, action] = patternMatch;
    if (new RegExp(pattern).test(line)) {
      const actionMatch = action.match(/^\\s*print\\s*(.*)$/);
      if (actionMatch) {
        const expr = actionMatch[1].trim();
        if (!expr) {
          console.log(line);
        } else {
          const parts = expr.split(/,/).map(p => {
            p = p.trim();
            if (p.startsWith('$')) {
              const n = p === '$NF' ? NF : parseInt(p.slice(1), 10);
              return getField(n);
            }
            if (p.startsWith('"') && p.endsWith('"')) {
              return p.slice(1, -1);
            }
            return p;
          });
          console.log(parts.join(' '));
        }
      }
    }
    return;
  }

  // Fallback: just print matching lines for /pattern/
  const simplePattern = prog.match(/^\\/(.+)\\/$/);
  if (simplePattern) {
    if (new RegExp(simplePattern[1]).test(line)) {
      console.log(line);
    }
    return;
  }
}

function processContent(content) {
  const lines = content.split('\\n');
  for (const line of lines) {
    if (line) executeProgram(line);
  }
}

if (files.length === 0) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => processContent(input));
} else {
  for (const file of files) {
    try {
      processContent(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error('awk: ' + file + ': No such file or directory');
      process.exit(2);
    }
  }
}
`;

/**
 * Xargs - build and execute command lines from stdin.
 */
const XARGS_SCRIPT = `#!/usr/bin/env node
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let replaceStr = null;
let maxArgs = null;
let command = 'echo';
let commandArgs = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-I') {
    replaceStr = args[++i];
  } else if (arg === '-n') {
    maxArgs = parseInt(args[++i], 10);
  } else if (!arg.startsWith('-')) {
    command = arg;
    commandArgs = args.slice(i + 1);
    break;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const items = input.split(/\\s+/).filter(item => item.trim());

  if (replaceStr) {
    for (const item of items) {
      const finalArgs = commandArgs.map(a => a.split(replaceStr).join(item));
      spawnSync(command, finalArgs, { stdio: 'inherit' });
    }
  } else if (maxArgs) {
    for (let i = 0; i < items.length; i += maxArgs) {
      const batch = items.slice(i, i + maxArgs);
      spawnSync(command, [...commandArgs, ...batch], { stdio: 'inherit' });
    }
  } else {
    spawnSync(command, [...commandArgs, ...items], { stdio: 'inherit' });
  }
});
`;

/**
 * Available Unix tools and their script content.
 */
export const UNIX_TOOLS: Record<string, string> = {
  grep: GREP_SCRIPT,
  find: FIND_SCRIPT,
  sed: SED_SCRIPT,
  cat: CAT_SCRIPT,
  head: HEAD_SCRIPT,
  tail: TAIL_SCRIPT,
  wc: WC_SCRIPT,
  awk: AWK_SCRIPT,
  xargs: XARGS_SCRIPT,
};

/**
 * List of tools that require ShellJS to be installed.
 */
export const SHELLJS_TOOLS = ["grep", "find", "sed", "cat", "head", "tail"];

/**
 * List of tools with custom implementations (no ShellJS dependency)
 */
export const STANDALONE_TOOLS = ["wc", "awk", "xargs"];

/**
 * Creates a FileSystemTree containing Unix tool scripts.
 */
export function createUnixToolsTree(
  tools: (keyof typeof UNIX_TOOLS)[] = Object.keys(UNIX_TOOLS),
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const tool of tools) {
    const script = UNIX_TOOLS[tool];

    if (script) {
      tree[tool] = {
        file: {
          contents: script,
        },
      };
    }
  }

  return tree;
}

/**
 * Type for WebContainer-like objects that can have Unix tools installed.
 */
export interface UnixToolsTarget {
  mount(tree: FileSystemTree, options?: { mountPoint?: string }): Promise<void>;
  spawn(
    command: string,
    args?: string[],
  ): Promise<{
    exit: Promise<number>;
    output: ReadableStream<string>;
  }>;
}

/**
 * Install Unix tools into a WebContainer instance.
 *
 * Tools that use ShellJS (grep, find, sed, cat, head, tail) require ShellJS
 * to be installed in the WebContainer. Set `installShellJS: true` to automatically
 * install it, or ensure it's already in your project's dependencies.
 *
 * Tools with standalone implementations (wc, awk, xargs) work without ShellJS.
 *
 * @param container - The WebContainer instance
 * @param options - Installation options
 *
 * @example
 * ```ts
 * // Install all tools (requires ShellJS in WebContainer)
 * await installUnixTools(webcontainer, { installShellJS: true });
 *
 * // Install only standalone tools (no ShellJS needed)
 * await installUnixTools(webcontainer, { tools: ['wc', 'awk', 'xargs'] });
 *
 * // Use the tools
 * const output = await webcontainer.runCommand('grep', ['pattern', 'file.txt']);
 * ```
 */
export async function installUnixTools(
  container: UnixToolsTarget,
  options: {
    tools?: (keyof typeof UNIX_TOOLS)[];
    mountPoint?: string;
    installShellJS?: boolean;
  } = {},
): Promise<void> {
  const {
    tools = Object.keys(UNIX_TOOLS),
    mountPoint = "/usr/local/bin",
    installShellJS = false,
  } = options;

  // check if any tools require ShellJS
  const needsShellJS = tools.some((tool) =>
    SHELLJS_TOOLS.includes(tool as string),
  );

  // install ShellJS if needed
  if (needsShellJS && installShellJS) {
    const proc = await container.spawn("npm", ["install", "shelljs", "--save"]);
    const exitCode = await proc.exit;

    if (exitCode !== 0) {
      throw new Error(`Failed to install shelljs (exit code: ${exitCode})`);
    }
  }

  const tree = createUnixToolsTree(tools);

  // mount the tools to the specified directory
  await container.mount(tree, { mountPoint });

  // make each tool executable
  for (const tool of tools) {
    if (UNIX_TOOLS[tool]) {
      const proc = await container.spawn("chmod", [
        "+x",
        `${mountPoint}/${tool}`,
      ]);
      await proc.exit;
    }
  }
}
