import { expect } from "vitest";

import { test } from "../src";

test(
  "installs isogit and git alias by default",
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

    await webcontainer.installGitTools();

    // verify git init works
    const output = await webcontainer.runCommand("git", ["init"]);
    expect(output).toContain("Initialized");
  },
);

test(
  "isogit command works directly",
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

    await webcontainer.installGitTools();

    // verify isogit init works
    const output = await webcontainer.runCommand("isogit", ["init"]);
    expect(output).toContain("Initialized");
  },
);

test(
  "git add stages files",
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

    await webcontainer.installGitTools();

    // init repo
    await webcontainer.runCommand("git", ["init"]);

    // create a file
    await webcontainer.writeFile("test.txt", "hello world");

    // add the file
    await webcontainer.runCommand("git", ["add", "test.txt"]);

    // check status
    const output = await webcontainer.runCommand("git", ["status"]);
    expect(output).toContain("test.txt");
  },
);

test(
  "git commit creates a commit",
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

    await webcontainer.installGitTools();

    // init repo
    await webcontainer.runCommand("git", ["init"]);

    // configure git user
    await webcontainer.runCommand("git", ["config", "user.name", "Test User"]);
    await webcontainer.runCommand("git", [
      "config",
      "user.email",
      "test@example.com",
    ]);

    // create and add a file
    await webcontainer.writeFile("test.txt", "hello world");
    await webcontainer.runCommand("git", ["add", "test.txt"]);

    // commit
    const output = await webcontainer.runCommand("git", [
      "commit",
      "-m",
      "Initial commit",
    ]);
    expect(output).toContain("Initial commit");
  },
);

test(
  "git log shows commit history",
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

    await webcontainer.installGitTools();

    // init repo
    await webcontainer.runCommand("git", ["init"]);

    // configure git user
    await webcontainer.runCommand("git", ["config", "user.name", "Test User"]);
    await webcontainer.runCommand("git", [
      "config",
      "user.email",
      "test@example.com",
    ]);

    // create and commit a file
    await webcontainer.writeFile("test.txt", "hello world");
    await webcontainer.runCommand("git", ["add", "test.txt"]);
    await webcontainer.runCommand("git", ["commit", "-m", "First commit"]);

    // check log
    const output = await webcontainer.runCommand("git", ["log"]);
    expect(output).toContain("First commit");
    expect(output).toContain("Test User");
  },
);

test(
  "git branch creates and lists branches",
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

    await webcontainer.installGitTools();

    // init repo
    await webcontainer.runCommand("git", ["init"]);

    // configure git user
    await webcontainer.runCommand("git", ["config", "user.name", "Test User"]);
    await webcontainer.runCommand("git", [
      "config",
      "user.email",
      "test@example.com",
    ]);

    // create initial commit (needed for branches)
    await webcontainer.writeFile("test.txt", "hello world");
    await webcontainer.runCommand("git", ["add", "test.txt"]);
    await webcontainer.runCommand("git", ["commit", "-m", "Initial commit"]);

    // create a new branch
    await webcontainer.runCommand("git", ["branch", "feature-branch"]);

    // list branches
    const output = await webcontainer.runCommand("git", ["branch"]);
    expect(output).toContain("feature-branch");
  },
);

test(
  "can skip isomorphic-git installation if already present",
  { retry: 3, timeout: 120000 },
  async ({ webcontainer }) => {
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify({
            name: "test-project",
            version: "1.0.0",
            devDependencies: {
              "isomorphic-git": "^1.27.1",
            },
          }),
        },
      },
    });

    // first install isomorphic-git via npm
    const npmInstall = webcontainer.runCommand("npm", ["install"]);
    await npmInstall;

    // now install tools without auto-installing isomorphic-git
    await webcontainer.installGitTools({
      installIsomorphicGit: false,
    });

    // should still work
    const output = await webcontainer.runCommand("git", ["init"]);
    expect(output).toContain("Initialized");
  },
);

test(
  "can install without git alias",
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

    await webcontainer.installGitTools({
      installGitAlias: false,
    });

    // isogit should work
    const output = await webcontainer.runCommand("isogit", ["init"]);
    expect(output).toContain("Initialized");
  },
);
