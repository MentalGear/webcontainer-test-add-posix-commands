import lg from "wasm-git/lg2_async.js";

let gitModule: any = null;

/**
 * Initialize the wasm-git module
 */
async function initGit() {
  if (!gitModule) {
    gitModule = await lg();
  }
  return gitModule;
}

/**
 * Call a git command with the provided arguments
 */
export async function callGit(args: string[]): Promise<string> {
  const git = await initGit();

  try {
    // Call the git command through the FS module
    const result = git.callMain(args);
    return result;
  } catch (error) {
    throw new Error(`Git command failed: ${error}`);
  }
}

/**
 * Initialize a git repository
 */
export async function init(path: string = "."): Promise<void> {
  await callGit(["init", path]);
}

/**
 * Add files to staging
 */
export async function add(files: string[]): Promise<void> {
  await callGit(["add", ...files]);
}

/**
 * Commit staged changes
 */
export async function commit(
  message: string,
  author?: { name: string; email: string },
): Promise<void> {
  const args = ["commit", "-m", message];

  if (author) {
    // Set author for this commit
    await callGit(["config", "user.name", author.name]);
    await callGit(["config", "user.email", author.email]);
  }

  await callGit(args);
}

/**
 * Get repository status
 */
export async function status(): Promise<string> {
  return await callGit(["status"]);
}

/**
 * Get commit log
 */
export async function log(
  options: { maxCount?: number } = {},
): Promise<string> {
  const args = ["log"];

  if (options.maxCount) {
    args.push(`-${options.maxCount}`);
  }

  return await callGit(args);
}

/**
 * Configure git settings
 */
export async function config(
  key: string,
  value: string,
  global: boolean = false,
): Promise<void> {
  const args = ["config"];
  if (global) {
    args.push("--global");
  }
  args.push(key, value);

  await callGit(args);
}

/**
 * Clone a repository
 */
export async function clone(url: string, path?: string): Promise<void> {
  const args = ["clone", url];
  if (path) {
    args.push(path);
  }

  await callGit(args);
}

/**
 * Push to remote
 */
export async function push(
  remote: string = "origin",
  branch?: string,
): Promise<void> {
  const args = ["push", remote];
  if (branch) {
    args.push(branch);
  }

  await callGit(args);
}

/**
 * Pull from remote
 */
export async function pull(
  remote: string = "origin",
  branch?: string,
): Promise<void> {
  const args = ["pull", remote];
  if (branch) {
    args.push(branch);
  }

  await callGit(args);
}
