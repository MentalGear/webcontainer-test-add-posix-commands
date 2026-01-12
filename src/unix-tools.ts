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
const { spawnSync } = require('child_process');
const args = process.argv.slice(2);
const result = spawnSync('npx', ['shx', '${command}', ...args], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
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
  "test",
  "dirs",
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
   * Directory to install tools. Defaults to "/usr/local/bin".
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
    mountPoint = "/usr/local/bin",
    installShx = true,
    overrideBuiltins = false,
  } = options;

  // install shx if needed
  if (installShx) {
    const proc = await container.spawn("npm", ["install", "shx", "--save-dev"]);
    const exitCode = await proc.exit;

    if (exitCode !== 0) {
      throw new Error(`Failed to install shx (exit code: ${exitCode})`);
    }
  }

  const tree = createUnixToolsTree(commands, overrideBuiltins);

  // check if there are any commands to install
  if (Object.keys(tree).length === 0) {
    return;
  }

  // mount the tools to the specified directory
  await container.mount(tree, { mountPoint });

  // make each tool executable
  for (const command of Object.keys(tree)) {
    const proc = await container.spawn("chmod", [
      "+x",
      `${mountPoint}/${command}`,
    ]);
    await proc.exit;
  }
}
