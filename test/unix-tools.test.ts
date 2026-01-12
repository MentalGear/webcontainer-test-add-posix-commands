import { expect } from "vitest";

import { test } from "../src";

test(
  "user can install standalone Unix tools (wc, awk, xargs)",
  { retry: 3, timeout: 60000 },
  async ({ webcontainer }) => {
    // install only standalone tools (no ShellJS needed)
    await webcontainer.installUnixTools({ tools: ["wc", "awk", "xargs"] });

    // create a test file
    await webcontainer.writeFile("test.txt", "hello world\nfoo bar baz\n");

    // test wc -l (line count)
    const wcOutput = await webcontainer.runCommand("wc", ["-l", "test.txt"]);
    expect(wcOutput).toContain("2");
    expect(wcOutput).toContain("test.txt");
  },
);

test(
  "wc counts words correctly",
  { retry: 3, timeout: 60000 },
  async ({ webcontainer }) => {
    await webcontainer.installUnixTools({ tools: ["wc"] });

    await webcontainer.writeFile("words.txt", "one two three\nfour five\n");

    const output = await webcontainer.runCommand("wc", ["-w", "words.txt"]);
    expect(output).toContain("5");
  },
);

test(
  "awk can extract fields",
  { retry: 3, timeout: 60000 },
  async ({ webcontainer }) => {
    await webcontainer.installUnixTools({ tools: ["awk"] });

    await webcontainer.writeFile("data.txt", "alice 30\nbob 25\ncharlie 35\n");

    // extract first column
    const output = await webcontainer.runCommand("awk", [
      "{print $1}",
      "data.txt",
    ]);
    expect(output).toContain("alice");
    expect(output).toContain("bob");
    expect(output).toContain("charlie");
  },
);

test(
  "awk can use custom field separator",
  { retry: 3, timeout: 60000 },
  async ({ webcontainer }) => {
    await webcontainer.installUnixTools({ tools: ["awk"] });

    await webcontainer.writeFile("csv.txt", "alice,30\nbob,25\n");

    const output = await webcontainer.runCommand("awk", [
      "-F",
      ",",
      "{print $2}",
      "csv.txt",
    ]);
    expect(output).toContain("30");
    expect(output).toContain("25");
  },
);

test(
  "user can install ShellJS-based tools with installShellJS option",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    // create a minimal package.json for npm install
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "test-project",
            version: "1.0.0",
          }),
        },
      },
    });

    // install grep tool with ShellJS
    await webcontainer.installUnixTools({
      tools: ["grep"],
      installShellJS: true,
    });

    // create test file
    await webcontainer.writeFile(
      "search.txt",
      "hello world\nfoo bar\nhello again\n",
    );

    // test grep
    const output = await webcontainer.runCommand("grep", [
      "hello",
      "search.txt",
    ]);
    expect(output).toContain("hello world");
    expect(output).toContain("hello again");
    expect(output).not.toContain("foo bar");
  },
);

test(
  "find locates files by name pattern",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "test-project",
            version: "1.0.0",
          }),
        },
      },
    });

    await webcontainer.installUnixTools({
      tools: ["find"],
      installShellJS: true,
    });

    // create test directory structure
    await webcontainer.mkdir("src");
    await webcontainer.writeFile("src/app.js", "console.log('app');");
    await webcontainer.writeFile("src/util.js", "console.log('util');");
    await webcontainer.writeFile("src/readme.md", "# Readme");

    // find all js files
    const output = await webcontainer.runCommand("find", [
      "src",
      "-name",
      "*.js",
    ]);
    expect(output).toContain("app.js");
    expect(output).toContain("util.js");
    expect(output).not.toContain("readme.md");
  },
);

test(
  "sed performs text substitution",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "test-project",
            version: "1.0.0",
          }),
        },
      },
    });

    await webcontainer.installUnixTools({
      tools: ["sed"],
      installShellJS: true,
    });

    await webcontainer.writeFile("replace.txt", "hello world\nhello again\n");

    const output = await webcontainer.runCommand("sed", [
      "s/hello/hi/g",
      "replace.txt",
    ]);
    expect(output).toContain("hi world");
    expect(output).toContain("hi again");
  },
);
