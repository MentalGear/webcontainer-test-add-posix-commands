import type { FileSystemTree } from "@webcontainer/api";

/**
 * Node.js wrapper scripts that use ShellJS for Unix command implementations.
 * ShellJS is battle-tested and provides reliable cross-platform behavior.
 *
 * These scripts require ShellJS to be installed in the WebContainer.
 */

/**
 * Commands that WebContainers (jsh) already provides.
 * These will be skipped by default unless explicitly overridden.
 */
export const WEBCONTAINER_BUILTINS = [
  // /bin
  "cat",
  "chmod",
  "cp",
  "echo",
  "kill",
  "ln",
  "ls",
  "mkdir",
  "mv",
  "pwd",
  "rm",
  "rmdir",

  // /usr/bin
  "cd",
  "clear",
  "curl",
  "env",
  "head",
  "sort",
  "tail",
  "touch",
  "which",
] as const;

/**
 * Creates a shx wrapper script for a given command.
 * Uses npx to run shx with the command and all arguments.
 */
function createShxWrapper(command: string): string {
  return `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const shxPath = path.resolve(__dirname, '../shx/lib/cli.js');
const args = process.argv.slice(2);

// Tools that ShellJS/shx doesn't support stdin for (bridging via temp file)
const STDIN_FALLBACK_COMMANDS = ['uniq', 'sort', 'head', 'tail'];
const isFallbackCommand = STDIN_FALLBACK_COMMANDS.includes('${command}');
// Heuristic: if no arguments or all arguments are flags
const hasNoFileArgs = args.length === 0 || !args.some(arg => !arg.startsWith('-'));

if (isFallbackCommand && hasNoFileArgs && !process.stdin.isTTY) {
  const tempFile = path.join('/tmp', 'shx-stdin-' + Math.random().toString(36).slice(2));
  const writeStream = fs.createWriteStream(tempFile);
  
  process.stdin.pipe(writeStream);
  
  writeStream.on('finish', () => {
    const child = spawn('node', [shxPath, '${command}', ...args, tempFile], {
      stdio: 'inherit'
    });
    child.on('exit', (code) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      process.exit(code ?? 0);
    });
  });
} else {
  const child = spawn('node', [shxPath, '${command}', ...args], {
    stdio: ['pipe', 'inherit', 'inherit']
  });
  
  if (!process.stdin.isTTY) {
    process.stdin.pipe(child.stdin);
  }

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}
`;
}

/**
 * All ShellJS commands available via shx.
 */
export const ALL_SHELLJS_COMMANDS = [
  "cat",
  "cd",
  "chmod",
  "cp",
  "dirs",
  "echo",
  "find",
  "grep",
  "head",
  "ln",
  "ls",
  "mkdir",
  "mv",
  "pwd",
  "rm",
  "sed",
  "sort",
  "tail",
  "test",
  "touch",
  "uniq",
] as const;

/**
 * ShellJS commands that WebContainers does NOT have built-in.
 * These are the recommended commands to install.
 */
export const RECOMMENDED_COMMANDS = [
  "grep",
  "find",
  "sed",
  "uniq",
  // "test",
  // "dirs",
] as const;

/**
 * Type for available ShellJS commands.
 */
export type ShellJSCommand = (typeof ALL_SHELLJS_COMMANDS)[number];

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
 * Options for installing Unix tools.
 */
export interface InstallUnixToolsOptions {
  /**
   * Specific commands to install. Defaults to RECOMMENDED_COMMANDS.
   */
  commands?: readonly ShellJSCommand[] | ShellJSCommand[];

  /**
   * Directory to install tools. Defaults to "usr/local/bin" (relative to root).
   */
  mountPoint?: string;

  /**
   * Whether to automatically install shx in the WebContainer.
   * Defaults to true.
   */
  installShx?: boolean;

  /**
   * Whether to install commands even if WebContainers already has them.
   * Defaults to false (skip built-ins).
   */
  overrideBuiltins?: boolean;
}

/**
 * Creates a FileSystemTree containing shx wrapper scripts.
 */
export function createUnixToolsTree(
  commands: readonly ShellJSCommand[],
  overrideBuiltins: boolean = false,
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const command of commands) {
    // skip WebContainer built-ins unless override is enabled
    if (
      !overrideBuiltins &&
      WEBCONTAINER_BUILTINS.includes(
        command as (typeof WEBCONTAINER_BUILTINS)[number],
      )
    ) {
      continue;
    }

    tree[command] = {
      file: {
        contents: createShxWrapper(command),
      },
    };
  }

  return tree;
}

/**
 * The default directory where tools are installed within the WebContainer.
 * Using a sub-folder in node_modules/.bin is reliable and keeps the bin directory clean.
 */
export const DEFAULT_MOUNT_POINT = "node_modules/.bin";

/**
 * Install Unix tools into a WebContainer instance.
 *
 * By default, installs the recommended commands (grep, find, sed, uniq, test, dirs)
 * that are missing from WebContainers' built-in jsh shell.
 *
 * @param container - The WebContainer instance.
 * @param options - Installation options.
 *
 * @example
 * ```ts
 * // Install recommended commands (grep, find, sed, uniq, test, dirs)
 * await installUnixTools(webcontainer);
 *
 * // Install specific commands only
 * await installUnixTools(webcontainer, { commands: ['grep', 'sed'] });
 *
 * // Install all ShellJS commands, including those WebContainers already has
 * await installUnixTools(webcontainer, {
 *   commands: ALL_SHELLJS_COMMANDS,
 *   overrideBuiltins: true,
 * });
 *
 * // Use the installed tools
 * const output = await webcontainer.runCommand('grep', ['pattern', 'file.txt']);
 * ```
 */
export async function installUnixTools(
  container: UnixToolsTarget,
  options: InstallUnixToolsOptions = {},
): Promise<void> {
  const {
    commands = RECOMMENDED_COMMANDS,
    mountPoint = DEFAULT_MOUNT_POINT,
    installShx = true,
    overrideBuiltins = false,
  } = options;

  // install shx if needed
  if (installShx) {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        "npm install shx --save-dev",
      ]);
      const exitCode = await proc.exit;

      if (exitCode !== 0) {
        throw new Error(`npm install shx failed with exit code ${exitCode}`);
      }
    } catch (e: any) {
      throw new Error(`Step: Install shx - ${e.message}`);
    }
  }

  const tree = createUnixToolsTree(commands, overrideBuiltins);

  // check if there are any commands to install
  if (Object.keys(tree).length === 0) {
    return;
  }

  // ensure the mount point exists
  if (mountPoint && mountPoint !== "." && mountPoint !== "/") {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        `mkdir -p "${mountPoint}"`,
      ]);
      await proc.exit;
    } catch (e: any) {
      // ignore errors if mkdir fails (e.g. dir already exists)
    }
  }

  // mount the tools to the specified directory
  try {
    await container.mount(tree, { mountPoint });
  } catch (e: any) {
    throw new Error(`Step: Mount tools to ${mountPoint} - ${e.message}`);
  }

  // make each tool executable
  for (const command of Object.keys(tree)) {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        `chmod +x "${mountPoint}/${command}"`,
      ]);
      const exitCode = await proc.exit;
      if (exitCode !== 0) {
        throw new Error(
          `chmod +x failed for ${command} with exit code ${exitCode}`,
        );
      }
    } catch (e: any) {
      throw new Error(`Step: Make ${command} executable - ${e.message}`);
    }
  }
}
