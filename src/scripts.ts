/**
 * Custom implementation of 'find' that supports standard POSIX flags.
 */
export const FIND_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const paths = [];
const options = {
  name: null,
  type: null,
  maxdepth: Infinity
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-name' || arg === '-n') {
    options.name = args[++i];
  } else if (arg === '-type') {
    const typeArg = args[++i];
    options.type = (typeArg === 'f' || typeArg === 'd') ? typeArg : null;
  } else if (arg === '-maxdepth') {
    options.maxdepth = parseInt(args[++i], 10);
  } else if (arg && arg.startsWith('-')) {
    // Ignore others
  } else {
    paths.push(arg);
  }
}

if (paths.length === 0) paths.push('.');

function matchName(fileName, pattern) {
  if (!pattern) return true;
  // Escape regex special chars but keep * and ?
  const regexStr = '^' + pattern
    .replace(/[.+^\\${\\}(\\)|[\\]\\\\]/g, '\\\\$&')
    .replace(/\\\\\\*/g, '.*')
    .replace(/\\\\\\?/g, '.') + '$';
  try {
    return new RegExp(regexStr).test(fileName);
  } catch (e) {
    return false;
  }
}

function walk(dir, depth) {
  if (depth > options.maxdepth) return;
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      let stats;
      try {
        stats = fs.lstatSync(fullPath);
      } catch (e) {
        continue;
      }
      const isDir = stats.isDirectory();
      const nameMatch = matchName(f, options.name);
      const typeMatch = !options.type || 
                        (options.type === 'd' && isDir) || 
                        (options.type === 'f' && stats.isFile());
      if (nameMatch && typeMatch) {
        process.stdout.write(fullPath + '\\n');
      }
      if (isDir) {
        walk(fullPath, depth + 1);
      }
    }
  } catch (e) {}
}

paths.forEach(startPath => {
  let stats;
  try {
    stats = fs.lstatSync(startPath);
  } catch (e) {
    process.stderr.write(\`find: \${startPath}: No such file or directory\\n\`);
    return;
  }
  const isDir = stats.isDirectory();
  const nameMatch = matchName(path.basename(startPath) || startPath, options.name);
  const typeMatch = !options.type || 
                    (options.type === "d" && isDir) || 
                    (options.type === "f" && stats.isFile());
  if (nameMatch && typeMatch) {
    process.stdout.write(startPath + '\\n');
  }
  if (isDir) {
    walk(startPath, 1);
  }
});
`;

/**
 * Custom 'shx' wrapper logic. Intercepts 'find' and delegates others.
 */
export const SHX_SCRIPT = `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0];

if (command === 'find') {
  // Use our improved find command
  const findPath = path.join(__dirname, 'find');
  const child = spawn('node', [findPath, ...args.slice(1)], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  const realShxPath = path.resolve(__dirname, '../shx/lib/cli.js');
  
  const STDIN_FALLBACK_COMMANDS = ['uniq', 'sort', 'head', 'tail'];
  if (STDIN_FALLBACK_COMMANDS.includes(command) && !process.stdin.isTTY) {
    const hasFileArg = args.slice(1).some(arg => !arg.startsWith('-'));
    if (!hasFileArg) {
      const tempFile = path.join('/tmp', 'shx-stdin-' + Math.random().toString(36).slice(2));
      const writeStream = fs.createWriteStream(tempFile);
      process.stdin.pipe(writeStream);
      writeStream.on('finish', () => {
        const child = spawn('node', [realShxPath, ...args, tempFile], { stdio: 'inherit' });
        child.on('exit', (code) => {
          try { fs.unlinkSync(tempFile); } catch (e) {}
          process.exit(code ?? 0);
        });
      });
      return;
    }
  }

  const child = spawn('node', [realShxPath, ...args], {
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (!process.stdin.isTTY) {
    process.stdin.pipe(child.stdin);
  }
  child.on('exit', (code) => process.exit(code ?? 0));
}
`;
