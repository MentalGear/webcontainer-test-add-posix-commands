#!/usr/bin/env bun

/**
 * CLI wrapper for wasm-git
 * Usage: bun playground/git.ts <command> [args...]
 * Example: bun playground/git.ts status
 */

import { callGit } from "../src/git-tools";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: bun playground/git.ts <command> [args...]");
    console.log("");
    console.log("Common commands:");
    console.log("  init              Initialize a new repository");
    console.log("  status            Show working tree status");
    console.log("  add <files>       Add files to staging");
    console.log("  commit -m <msg>   Commit staged changes");
    console.log("  log               Show commit logs");
    console.log("  config            Get/set configuration");
    console.log("  clone <url>       Clone a repository");
    console.log("  push              Push to remote");
    console.log("  pull              Pull from remote");
    process.exit(1);
  }

  try {
    const output = await callGit(args);
    if (output) {
      console.log(output);
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
