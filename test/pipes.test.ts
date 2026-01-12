import { expect } from "vitest";
import { test } from "../src";

const normalize = (output: any) =>
  String(output)
    .split("\n")
    .filter((line) => !line.startsWith("[shim:"))
    .join("\n")
    .replace(/\r/g, "")
    .trim();

test(
  "handles 3-pipe chain: cat | sort | uniq",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "pipe-test", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({
      commands: ["sort", "uniq"],
      overrideBuiltins: true,
    });

    await webcontainer.writeFile("numbers.txt", "3\n1\n2\n1\n3\n2\n1\n3\n");

    // cat (builtin) | sort (shx) | uniq (shx)
    const rawOutput = await webcontainer.runCommand("sh", [
      "-c",
      "cat numbers.txt | sort | uniq",
    ]);

    const output = normalize(rawOutput);
    expect(output).toBe("1\n2\n3");
  },
);

test(
  "handles complex chain: cat | grep | head",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "pipe-test", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({
      commands: ["grep", "head"],
      overrideBuiltins: true,
    });

    await webcontainer.writeFile(
      "test.txt",
      "hello 1\nworld 1\nhello 2\nworld 2\nhello 3\n",
    );

    // cat (builtin) | grep (shx) | head (shx)
    const rawOutput = await webcontainer.runCommand("sh", [
      "-c",
      "cat test.txt | grep hello | head -n 2",
    ]);

    const output = normalize(rawOutput);
    expect(output).toBe("hello 1\nhello 2");
  },
);

test(
  "handles reverse sort and head: cat | sort -r | head",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "pipe-test", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({
      commands: ["sort", "head"],
      overrideBuiltins: true,
    });

    await webcontainer.writeFile("lines.txt", "a\nb\nc\nd\n");

    // cat (builtin) | sort -r (shx) | head (shx)
    const rawOutput = await webcontainer.runCommand("sh", [
      "-c",
      "cat lines.txt | sort -r | head -n 2",
    ]);

    const output = normalize(rawOutput);
    expect(output).toBe("d\nc");
  },
);

test(
  "handles single-pipe sort: cat | sort",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "pipe-test", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({
      commands: ["sort"],
      overrideBuiltins: true,
    });

    await webcontainer.writeFile("numbers.txt", "3\n1\n2\n");

    const rawOutput = await webcontainer.runCommand("sh", [
      "-c",
      "cat numbers.txt | sort",
    ]);

    const output = normalize(rawOutput);
    expect(output).toBe("1\n2\n3");
  },
);

test(
  "handles nested pipe with sed: cat | sed | grep",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "pipe-test", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({
      commands: ["sed", "grep"],
      overrideBuiltins: true,
    });

    await webcontainer.writeFile("replace.txt", "apple\nbanana\napple\n");

    // cat (builtin) | sed (shx) | grep (shx)
    const rawOutput = await webcontainer.runCommand("sh", [
      "-c",
      "cat replace.txt | sed 's/apple/orange/g' | grep orange",
    ]);

    const output = normalize(rawOutput);
    const lines = output.split("\n");
    expect(lines[0]).toBe("orange");
    expect(lines[1]).toBe("orange");
  },
);
