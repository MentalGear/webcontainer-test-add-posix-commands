import { WebContainer } from "@webcontainer/api";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { installUnixTools, RECOMMENDED_COMMANDS } from "../src/unix-tools";

const status = document.getElementById("status") as HTMLDivElement;
const filesDiv = document.getElementById("files") as HTMLDivElement;

// Initialize xterm.js
const term = new Terminal({
  cursorBlink: true,
  convertEol: true,
  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
  fontSize: 13,
  theme: {
    background: "#0d1117",
    foreground: "#c9d1d9",
  },
});
term.open(document.getElementById("terminal") as HTMLDivElement);

let webcontainer: WebContainer;
let rootPath: string = "";
const toolsDir = "node_modules/.bin";

function setStatus(text: string, type: string) {
  status.textContent = text;
  status.className = "status " + type;
}

async function updateFilesList() {
  try {
    // List files from root, ignoring .git, node_modules, etc.
    const process = await webcontainer.spawn("jsh", [
      "-c",
      "find . -type f -not -path '*/.*' -not -path '*/node_modules/*'",
    ]);
    let output = "";

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      }),
    );

    await process.exit;

    const files = output
      .trim()
      .split("\n")
      .filter((f) => f.trim())
      .sort();

    filesDiv.innerHTML = files.map((f) => `<div>${f}</div>`).join("");
  } catch (e) {
    filesDiv.textContent = "Error loading files";
  }
}

async function boot() {
  try {
    term.writeln("\x1b[36mBooting WebContainer...\x1b[0m");
    webcontainer = await WebContainer.boot();

    // Capture absolute root path
    const rootProc = await webcontainer.spawn("pwd");
    let rawRoot = "";
    rootProc.output.pipeTo(
      new WritableStream({
        write(data) {
          rawRoot += data;
        },
      }),
    );
    await rootProc.exit;
    rootPath = rawRoot.trim();
    term.writeln(`\x1b[90mProject root: ${rootPath}\x1b[0m`);

    term.writeln("\x1b[36mCreating project files...\x1b[0m");

    // Mount initial files
    await webcontainer.mount({
      "package.json": {
        file: {
          contents: JSON.stringify(
            {
              name: "unix-tools-playground",
              version: "1.0.0",
              devDependencies: {
                shx: "^0.3.4",
                "wasm-git": "^0.0.13",
              },
            },
            null,
            2,
          ),
        },
      },
      "test.txt": {
        file: {
          contents:
            "hello world\nfoo bar\nhello again\ntest line\nhello there\n",
        },
      },
      "dupes.txt": {
        file: {
          contents: "apple\napple\nbanana\nbanana\nbanana\napple\ncherry\n",
        },
      },
      "numbers.txt": {
        file: {
          contents: "3\n1\n2\n1\n3\n2\n1\n",
        },
      },
      src: {
        directory: {
          "app.js": {
            file: { contents: 'console.log("app");' },
          },
          "util.js": {
            file: { contents: 'console.log("util");' },
          },
          "readme.md": {
            file: { contents: "# Source\n" },
          },
        },
      },
    });

    term.writeln("\x1b[36mInstalling dependencies...\x1b[0m");
    const installProc = await webcontainer.spawn("jsh", ["-c", "npm install"]);
    installProc.output.pipeTo(
      new WritableStream({
        write(data) {
          term.write(data);
        },
      }),
    );
    const installExit = await installProc.exit;
    if (installExit !== 0) {
      throw new Error(`npm install failed with code ${installExit}`);
    }

    term.writeln("\x1b[36mInstalling Unix tools...\x1b[0m");

    // Use the library's installUnixTools - skip shx install as we did it above
    await installUnixTools(
      {
        mount: (tree, opts) => webcontainer.mount(tree, opts),
        spawn: async (cmd, args) => {
          // We don't need to log every spawn here, but we can
          // term.writeln(`\x1b[90m$ ${cmd} ${(args ?? []).join(" ")}\x1b[0m`);
          return webcontainer.spawn(cmd, args ?? []);
        },
      },
      {
        mountPoint: toolsDir,
        overrideBuiltins: true,
        installShx: false, // Already installed via npm install
      },
    );

    // Fetch and mount the git wrapper script
    term.writeln("\x1b[36mMounting git command...\x1b[0m");
    const gitWrapperResponse = await fetch("/git-wrapper.js");
    const gitWrapperContent = await gitWrapperResponse.text();

    await webcontainer.mount(
      {
        git: {
          file: {
            contents: gitWrapperContent,
          },
        },
      },
      { mountPoint: toolsDir },
    );

    // Make git executable
    const chmodGitProc = await webcontainer.spawn("jsh", [
      "-c",
      `chmod +x ${toolsDir}/git`,
    ]);
    await chmodGitProc.exit;

    term.writeln(
      "\x1b[32mReady! Unix tools installed: " +
        RECOMMENDED_COMMANDS.join(", ") +
        ", git\x1b[0m",
    );
    term.writeln("");

    // Confirm files exist
    term.writeln("\x1b[36mVerifying installation...\x1b[0m");
    const lsProc = await webcontainer.spawn("jsh", [
      "-c",
      `ls -la ${toolsDir}`,
    ]);
    lsProc.output.pipeTo(
      new WritableStream({
        write(data) {
          term.write(data);
        },
      }),
    );
    await lsProc.exit;

    // Try running git non-interactively to prove it works
    term.writeln("\x1b[36mTest run: git --version\x1b[0m");
    const testProc = await webcontainer.spawn(
      "jsh",
      ["-c", `export PATH="${rootPath}/${toolsDir}:$PATH" && git --version`], // use explicit path here to test
    );
    testProc.output.pipeTo(
      new WritableStream({
        write(data) {
          term.write(data);
        },
      }),
    );
    const testExit = await testProc.exit;
    term.writeln(
      testExit === 0
        ? "\x1b[32mGit test passed\x1b[0m"
        : `\x1b[31mGit test failed: ${testExit}\x1b[0m`,
    );

    setStatus("Ready - Shell Active", "ready");

    // Update files list
    await updateFilesList();

    // Start interactive shell
    startShell();
  } catch (error: any) {
    term.writeln(`\x1b[31mError: ${error.message}\x1b[0m`);
    setStatus("Error: " + error.message, "error");
  }
}

async function startShell() {
  term.writeln("\x1b[33mStarting jsh shell...\x1b[0m");

  const shellProcess = await webcontainer.spawn("jsh", {
    terminal: {
      rows: term.rows,
      cols: term.cols,
    },
  });

  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        term.write(data);
      },
    }),
  );

  const input = shellProcess.input.getWriter();

  // FIX: Explicitly set PATH in the shell session because jsh might override env or not pick it up correctly for interactive sessions
  await input.write(`export PATH="${rootPath}/${toolsDir}:$PATH"\r`);
  // Optional: clear the output of the export command so it looks cleaner
  // await input.write('clear\r');

  term.onData((data) => {
    input.write(data);
  });

  // Handle Quick Commands
  document
    .querySelectorAll<HTMLButtonElement>(".command-btn")
    .forEach((btn) => {
      btn.disabled = false;
      btn.addEventListener("click", () => {
        const cmd = btn.getAttribute("data-cmd");
        if (cmd) {
          // Send command to shell input + newline
          input.write(cmd + "\r");
        }
      });
    });

  // Resize handling
  // Note: jsh doesn't currently support dynamic resizing via API easily without sending signals,
  // checking if resize method exists on process
  if ((shellProcess as any).resize) {
    // Only if the API supports it in the future or now
    // For now we just ignore or we can try.
    // WebContainer API v1.x supports resize
    window.addEventListener("resize", () => {
      // term.fit() if we had the addon
      // manually:
      // (shellProcess as any).resize({ cols: term.cols, rows: term.rows });
    });
  }
}

// Start
boot();
