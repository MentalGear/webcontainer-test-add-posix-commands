#!/usr/bin/env node

/**
 * Git command wrapper using wasm-git
 * This script is designed to run inside a WebContainer
 */

let gitModule = null;

async function initGit() {
  if (!gitModule) {
    try {
      // Dynamic import of wasm-git ES module
      const lgModule = await import("wasm-git/lg2_async.js");

      // The module exports a default function that initializes the WASM module
      const lgInit = lgModule.default;

      if (typeof lgInit !== "function") {
        throw new Error(
          "wasm-git module did not export an initialization function",
        );
      }

      // Initialize the WASM module
      gitModule = await lgInit();
    } catch (error) {
      throw new Error(`Failed to initialize wasm-git: ${error.message}`);
    }
  }
  return gitModule;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("usage: git <command> [<args>]");
    console.log("");
    console.log("Common Git commands:");
    console.log("   init       Create an empty Git repository");
    console.log("   status     Show the working tree status");
    console.log("   add        Add file contents to the index");
    console.log("   commit     Record changes to the repository");
    console.log("   log        Show commit logs");
    console.log("   config     Get and set repository options");
    process.exit(1);
  }

  try {
    const git = await initGit();

    // Mount local filesystem
    // We need to mount the host's current working directory into the WASM environment
    // so that git can access the actual files.
    if (git.FS && git.FS.filesystems && git.FS.filesystems.NODEFS) {
      const mountPoint = "/mnt";
      try {
        // Ensure mount point exists
        try {
          git.FS.stat(mountPoint);
        } catch (e) {
          git.FS.mkdir(mountPoint);
        }

        // Mount process.cwd() to /mnt
        git.FS.mount(
          git.FS.filesystems.NODEFS,
          { root: process.cwd() },
          mountPoint,
        );

        // Change directory to the mount point
        git.FS.chdir(mountPoint);

        // Configure git to trust the directory (fix for CVE-2022-24765)
        // Since the owner of the mounted directory (host user) differs from the WASM user
        // We set this globally in the WASM environment's memory/FS
        const homeDir = "/home/web_user";
        try {
          // Ensure home exists
          try {
            git.FS.mkdir("/home");
          } catch (e) {}
          try {
            git.FS.mkdir(homeDir);
          } catch (e) {}

          // Write .gitconfig
          git.FS.writeFile(
            `${homeDir}/.gitconfig`,
            "[safe]\n\tdirectory = *\n",
          );

          // Ensure HOME environment variable points to it
          // Emscripten environment variables
          if (git.ENV) {
            git.ENV.HOME = homeDir;
          } else {
            // Fallback for some emscripten versions if ENV is not directly exposed but might be in other ways
            // Often setting it in process.env before init might help, but here we are post-init.
            // We'll rely on git reading global config from standard locations if HOME isn't set perfectly,
            // but usually emscripten uses /home/web_user by default or we can try to set it.
          }
        } catch (e) {
          console.warn(`Warning: Failed to set .gitconfig: ${e.message}`);
        }
      } catch (e) {
        // If mount fails, it might be because it's already mounted?
        console.warn(`Warning: Failed to mount NODEFS: ${e.message}`);
        // Fallback: try to just chdir if mount failed (maybe already mounted?)
        try {
          git.FS.chdir(mountPoint);
        } catch (ignore) {}
      }
    } else {
      console.warn(
        "Warning: NODEFS not available in wasm-git. Filesystem changes won't be persisted.",
      );
    }

    // Call git with the provided arguments
    // The WASM module provides a callMain function
    const result = git.callMain(args);
    // Handle both sync and async return values
    const exitCode = result instanceof Promise ? await result : result;

    process.exit(exitCode || 0);
  } catch (error) {
    console.error("git:", error.message || String(error));
    process.exit(1);
  }
}

main();
