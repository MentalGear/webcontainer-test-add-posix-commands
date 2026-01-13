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

    // Call git with the provided arguments
    // The WASM module provides a callMain function
    const exitCode = git.callMain(args);

    process.exit(exitCode || 0);
  } catch (error) {
    console.error("git:", error.message || String(error));
    process.exit(1);
  }
}

main();
