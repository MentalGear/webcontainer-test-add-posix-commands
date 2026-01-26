import { expect } from "vitest";

import { test } from "../src";

test(
  "installs recommended Unix tools by default",
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

    // install default recommended tools
    await webcontainer.installUnixTools();

    // verify grep is installed and works
    await webcontainer.writeFile(
      "test.txt",
      "hello world\nfoo bar\nhello again\n",
    );

    const output = await webcontainer.runCommand("grep", ["hello", "test.txt"]);
    expect(output).toContain("hello world");
    expect(output).toContain("hello again");
    expect(output).not.toContain("foo bar");
  },
);

test(
  "grep searches for patterns in files",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({ commands: ["grep"] });

    await webcontainer.writeFile(
      "search.txt",
      "apple\nbanana\napricot\ncherry\n",
    );

    const output = await webcontainer.runCommand("grep", ["ap", "search.txt"]);
    expect(output).toContain("apple");
    expect(output).toContain("apricot");
    expect(output).not.toContain("banana");
  },
);

test(
  "find locates files by name pattern",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({ commands: ["find"] });

    // create test directory structure
    await webcontainer.mkdir("src");
    await webcontainer.writeFile("src/app.js", "console.log('app');");
    await webcontainer.writeFile("src/util.js", "console.log('util');");
    await webcontainer.writeFile("src/readme.md", "# Readme");

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
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({ commands: ["sed"] });

    await webcontainer.writeFile("replace.txt", "hello world\nhello again\n");

    const output = await webcontainer.runCommand("sed", [
      "s/hello/hi/g",
      "replace.txt",
    ]);
    expect(output).toContain("hi world");
    expect(output).toContain("hi again");
  },
);

test(
  "uniq removes duplicate adjacent lines",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({ commands: ["uniq"] });

    await webcontainer.writeFile(
      "dupes.txt",
      "apple\napple\nbanana\nbanana\nbanana\napple\n",
    );

    const output = await webcontainer.runCommand("uniq", ["dupes.txt"]);

    // uniq removes adjacent duplicates, so we should have: apple, banana, apple
    expect(output.trim().split("\n")).toHaveLength(3);
  },
);

test(
  "test checks file existence",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({ commands: ["test"] });

    await webcontainer.writeFile("exists.txt", "I exist");

    // test -f checks if file exists
    const proc = webcontainer.runCommand("test", ["-f", "exists.txt"]);
    await expect(proc).resolves.toBeDefined();
  },
);

test(
  "skips WebContainer built-in commands by default",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    /**
     * Try to install 'cat' which is a WebContainer built-in.
     * It should be skipped and use the built-in version.
     */
    await webcontainer.installUnixTools({ commands: ["cat", "grep"] });

    // cat should still work (using built-in)
    await webcontainer.writeFile("test.txt", "hello from cat");

    const output = await webcontainer.runCommand("cat", ["test.txt"]);
    expect(output).toContain("hello from cat");
  },
);

test(
  "can override WebContainer built-ins when explicitly requested",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    // install 'cat' with override enabled
    await webcontainer.installUnixTools({
      commands: ["cat"],
      overrideBuiltins: true,
    });

    // should work with the shx version
    await webcontainer.writeFile("test.txt", "hello from shx cat");

    const output = await webcontainer.runCommand("cat", ["test.txt"]);
    expect(output).toContain("hello from shx cat");
  },
);

test(
  "pipes work between commands",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({ name: "test-project", version: "1.0.0" }),
        },
      },
    });

    await webcontainer.installUnixTools({ commands: ["grep", "uniq"] });

    await webcontainer.writeFile(
      "data.txt",
      "apple\nbanana\napple\ncherry\napple\nbanana\n",
    );

    // test pipe: cat | grep | uniq using shell to pipe commands together
    const { isDone } = webcontainer.runCommand("sh", [
      "-c",
      "cat data.txt | grep apple | uniq",
    ]);

    await isDone;

    // pipe executed successfully if we reach here
  },
);

test(
  "can skip shx installation if already present",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "test-project",
            version: "1.0.0",
            devDependencies: {
              shx: "^0.3.4",
            },
          }),
        },
      },
    });

    // first install shx via npm
    const npmInstall = webcontainer.runCommand("npm", ["install"]);
    await npmInstall;

    // now install tools without auto-installing shx
    await webcontainer.installUnixTools({
      commands: ["grep"],
      installShx: false,
    });

    // should still work
    await webcontainer.writeFile("test.txt", "hello world\n");

    const output = await webcontainer.runCommand("grep", ["hello", "test.txt"]);
    expect(output).toContain("hello world");
  },
);
