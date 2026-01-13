import type { FileSystemTree } from "@webcontainer/api";
import { FIND_SCRIPT, SHX_SCRIPT } from "./scripts";

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
 * All commands are routed through our custom shx to ensure consistent behavior.
 */
function createShxWrapper(command: string): string {
  return `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const shxPath = path.join(__dirname, 'shx');
const args = process.argv.slice(2);

const child = spawn('node', [shxPath, '${command}', ...args], {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
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
  "head",
  "tail",
  "sort",
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

  // Mount our custom shx engine engine
  tree["shx"] = {
    file: {
      contents: SHX_SCRIPT,
    },
  };

  // Mount find directly (our shx find will also delegate to this)
  tree["find"] = {
    file: {
      contents: FIND_SCRIPT,
    },
  };

  for (const command of commands) {
    if (command === "find") continue;

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
 * @param container - The WebContainer instance.
 * @param options - Installation options.
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

  // CRITICAL: If we are mounting to node_modules/.bin, we might be overwriting
  // the 'shx' symlink created by npm. Some filesystems/containers might have
  // issues mounting a file over a symlink. We ensure it's removed first.
  if (mountPoint === DEFAULT_MOUNT_POINT) {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        `rm -f "${mountPoint}/shx"`,
      ]);
      await proc.exit;
    } catch (e) {}
  }

  const tree = createUnixToolsTree(commands, overrideBuiltins);

  // ensure the mount point exists
  if (mountPoint && mountPoint !== "." && mountPoint !== "/") {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        `mkdir -p "${mountPoint}"`,
      ]);
      await proc.exit;
    } catch (e: any) {
      // ignore
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
