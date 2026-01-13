import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

/**
 * Custom 'shx' logic that intercepts 'find' and provides stdin fallback.
 */
export function shxLogic(
  args: string[],
  options: { findPath: string; realShxPath: string },
) {
  const command = args[0];

  if (command === "find") {
    const child = spawn("node", [options.findPath, ...args.slice(1)], {
      stdio: "inherit",
    });
    child.on("exit", (code) => process.exit(code ?? 0));
  } else {
    // Stdin fallback for tools that don't support it well in ShellJS
    const STDIN_FALLBACK_COMMANDS = ["uniq", "sort", "head", "tail"];
    if (STDIN_FALLBACK_COMMANDS.includes(command) && !process.stdin.isTTY) {
      const hasFileArg = args.slice(1).some((arg) => !arg.startsWith("-"));
      if (!hasFileArg) {
        const tempFile = path.join(
          "/tmp",
          "shx-stdin-" + Math.random().toString(36).slice(2),
        );
        const writeStream = fs.createWriteStream(tempFile);
        process.stdin.pipe(writeStream);
        writeStream.on("finish", () => {
          const child = spawn(
            "node",
            [options.realShxPath, ...args, tempFile],
            {
              stdio: "inherit",
            },
          );
          child.on("exit", (code) => {
            try {
              fs.unlinkSync(tempFile);
            } catch (e) {}
            process.exit(code ?? 0);
          });
        });
        return;
      }
    }

    const child = spawn("node", [options.realShxPath, ...args], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (!process.stdin.isTTY) {
      process.stdin.pipe(child.stdin);
    }
    child.on("exit", (code) => process.exit(code ?? 0));
  }
}
