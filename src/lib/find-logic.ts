import fs from "node:fs";
import path from "node:path";

export interface FindOptions {
  name: string | null;
  type: "f" | "d" | null;
  maxdepth: number;
}

/**
 * Core logic for the find command.
 */
export function findLogic(args: string[]): {
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const paths: string[] = [];
  const options: FindOptions = {
    name: null,
    type: null,
    maxdepth: Infinity,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-name" || arg === "-n") {
      options.name = args[++i];
    } else if (arg === "-type") {
      const typeArg = args[++i];
      options.type = typeArg === "f" || typeArg === "d" ? typeArg : null;
    } else if (arg === "-maxdepth") {
      options.maxdepth = parseInt(args[++i], 10);
    } else if (arg && arg.startsWith("-")) {
      // Ignore other flags for now
    } else {
      paths.push(arg);
    }
  }

  if (paths.length === 0) paths.push(".");

  function matchName(fileName: string, pattern: string | null): boolean {
    if (!pattern) return true;
    // glob-to-regex: * -> .*, . -> \\., ? -> .
    const regexStr =
      "^" +
      pattern
        .replace(/[.+^${}()|[\\]\\]/g, "\\$&")
        .replace(/\\\*/g, ".*")
        .replace(/\\\?/g, ".") +
      "$";
    try {
      return new RegExp(regexStr).test(fileName);
    } catch (e) {
      return false;
    }
  }

  function walk(dir: string, depth: number) {
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
        const typeMatch =
          !options.type ||
          (options.type === "d" && isDir) ||
          (options.type === "f" && stats.isFile());

        if (nameMatch && typeMatch) {
          stdout.push(fullPath);
        }

        if (isDir) {
          walk(fullPath, depth + 1);
        }
      }
    } catch (e) {}
  }

  paths.forEach((startPath) => {
    let stats;
    try {
      stats = fs.lstatSync(startPath);
    } catch (e) {
      stderr.push(`find: ${startPath}: No such file or directory`);
      return;
    }

    const isDir = stats.isDirectory();
    const nameMatch = matchName(
      path.basename(startPath) || startPath,
      options.name,
    );
    const typeMatch =
      !options.type ||
      (options.type === "d" && isDir) ||
      (options.type === "f" && stats.isFile());

    if (nameMatch && typeMatch) {
      stdout.push(startPath);
    }

    if (isDir) {
      walk(startPath, 1);
    }
  });

  return { stdout, stderr };
}
