import type { FileSystemTree } from "@webcontainer/api";

/**
 * Node.js wrapper scripts for isomorphic-git CLI.
 * Provides git functionality in WebContainers using isomorphic-git.
 *
 * @see https://github.com/isomorphic-git/isomorphic-git
 */

/**
 * Creates the isogit wrapper script.
 * Uses isomorphic-git CLI to provide git functionality.
 */
function createIsogitWrapper(): string {
  return `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const isogitPath = path.resolve(__dirname, '../isomorphic-git/cli.cjs');
const args = process.argv.slice(2);

const child = spawn('node', [isogitPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
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
 * Creates a git alias wrapper that forwards to isogit.
 */
function createGitAliasWrapper(): string {
  return `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const isogitPath = path.resolve(__dirname, '../isomorphic-git/cli.cjs');
const args = process.argv.slice(2);

const child = spawn('node', [isogitPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
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
 * Type for WebContainer-like objects that can have git tools installed.
 */
export interface GitToolsTarget {
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
 * Options for installing git tools.
 */
export interface InstallGitToolsOptions {
  /**
   * Directory to install tools. Defaults to "node_modules/.bin".
   */
  mountPoint?: string;

  /**
   * Whether to automatically install isomorphic-git in the WebContainer.
   * Defaults to true.
   */
  installIsomorphicGit?: boolean;

  /**
   * Whether to install the 'git' alias command.
   * Defaults to true.
   */
  installGitAlias?: boolean;
}

/**
 * Creates a FileSystemTree containing git wrapper scripts.
 */
export function createGitToolsTree(
  installGitAlias: boolean = true,
): FileSystemTree {
  const tree: FileSystemTree = {
    isogit: {
      file: {
        contents: createIsogitWrapper(),
      },
    },
  };

  if (installGitAlias) {
    tree.git = {
      file: {
        contents: createGitAliasWrapper(),
      },
    };
  }

  return tree;
}

/**
 * The default directory where tools are installed within the WebContainer.
 */
export const DEFAULT_GIT_MOUNT_POINT = "node_modules/.bin";

/**
 * Install git tools (isomorphic-git) into a WebContainer instance.
 *
 * Provides `isogit` command and optional `git` alias that use isomorphic-git
 * for git operations in WebContainers.
 *
 * @param container - The WebContainer instance.
 * @param options - Installation options.
 *
 * @example
 * ```ts
 * // Install isogit and git alias
 * await installGitTools(webcontainer);
 *
 * // Use the installed tools
 * await webcontainer.runCommand('git', ['init']);
 * await webcontainer.runCommand('git', ['add', '.']);
 * await webcontainer.runCommand('git', ['commit', '-m', 'Initial commit']);
 *
 * // Or use isogit directly
 * await webcontainer.runCommand('isogit', ['status']);
 * ```
 */
export async function installGitTools(
  container: GitToolsTarget,
  options: InstallGitToolsOptions = {},
): Promise<void> {
  const {
    mountPoint = DEFAULT_GIT_MOUNT_POINT,
    installIsomorphicGit = true,
    installGitAlias = true,
  } = options;

  // install isomorphic-git if needed
  if (installIsomorphicGit) {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        "npm install isomorphic-git --save-dev",
      ]);

      const exitCode = await proc.exit;

      if (exitCode !== 0) {
        throw new Error(
          `npm install isomorphic-git failed with exit code ${exitCode}`,
        );
      }
    } catch (error: any) {
      throw new Error(`Step: Install isomorphic-git - ${error.message}`);
    }
  }

  const tree = createGitToolsTree(installGitAlias);

  // ensure the mount point exists
  if (mountPoint && mountPoint !== "." && mountPoint !== "/") {
    try {
      const proc = await container.spawn("jsh", [
        "-c",
        `mkdir -p "${mountPoint}"`,
      ]);
      await proc.exit;
    } catch {
      // ignore errors if mkdir fails (e.g. dir already exists)
    }
  }

  // mount the tools to the specified directory
  try {
    await container.mount(tree, { mountPoint });
  } catch (error: any) {
    throw new Error(
      `Step: Mount git tools to ${mountPoint} - ${error.message}`,
    );
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
    } catch (error: any) {
      throw new Error(`Step: Make ${command} executable - ${error.message}`);
    }
  }
}
