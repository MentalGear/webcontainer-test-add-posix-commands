import { WebContainer } from "@webcontainer/api";
import { installUnixTools, RECOMMENDED_COMMANDS } from "../src/unix-tools";

const terminal = document.getElementById("terminal") as HTMLDivElement;
const status = document.getElementById("status") as HTMLDivElement;
const commandInput = document.getElementById("command") as HTMLInputElement;
const runButton = document.getElementById("run") as HTMLButtonElement;
const filesDiv = document.getElementById("files") as HTMLDivElement;

let webcontainer: WebContainer;
let currentDir: string = "";
let rootPath: string = "";

function log(text: string, color: string = "#c9d1d9") {
  // Enhanced ANSI escape code stripping (covers more cursor control codes)
  const cleanedText = text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );

  // If we have nothing left and it was noise, skip
  if (!cleanedText.trim() && text.includes("\u001b")) return;

  terminal.innerHTML += `<span style="color: ${color}">${escapeHtml(cleanedText)}</span>\n`;
  terminal.scrollTop = terminal.scrollHeight;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setStatus(text: string, type: string) {
  status.textContent = text;
  status.className = "status " + type;
}

async function updateFilesList() {
  try {
    const process = await webcontainer.spawn(
      "jsh",
      ["-c", "find . -type f -not -path '*/.*'"],
      { cwd: currentDir },
    );
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
      .filter((f) => !f.includes("node_modules") && f.trim())
      .sort();

    filesDiv.innerHTML = files
      .map((f) => `<div>${escapeHtml(f)}</div>`)
      .join("");
  } catch (e) {
    filesDiv.textContent = "Error loading files";
  }
}

// IMPRTAMT: for some reason cmds only can be executed when placed in a directory with the name .bin in node_modules
const toolsDir = "node_modules/.bin";

async function runCommand(cmd: string) {
  if (!cmd.trim()) return;

  log(`${currentDir || "/"} $ ${cmd}`, "#00d4ff");

  try {
    // Check for cd command
    // if (cmd.startsWith("cd ") || cmd === "cd") {
    //   const target = cmd === "cd" ? "/" : cmd.slice(3).trim();

    //   // We run cd in a subshell and capture the resulting pwd to update our state
    //   const proc = await webcontainer.spawn("jsh", [
    //     "-c",
    //     // `cd "${currentDir || "."}" && cd "${target}" && pwd`,
    //     `cd ${target}`,
    //   ]);

    //   let newPath = "";
    //   proc.output.pipeTo(
    //     new WritableStream({
    //       write(data) {
    //         newPath += data;
    //       },
    //     }),
    //   );

    //   const exitCode = await proc.exit;
    //   if (exitCode === 0) {
    //     currentDir = newPath.trim();
    //     log(`Changed directory to: ${currentDir || "/"}`);
    //     await updateFilesList();
    //     return;
    //   } else {
    //     log(`cd failed`, "#ff4444");
    //     return;
    //   }
    // }

    // Run command with toolsDir in PATH - USE ABSOLUTE PATH
    const process = await webcontainer.spawn(
      "jsh",
      ["-c", `export PATH="${rootPath}/${toolsDir}:$PATH" && ${cmd}`],
      {
        cwd: currentDir,
      },
    );

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          log(data.trimEnd());
        },
      }),
    );

    const exitCode = await process.exit;
    if (exitCode !== 0) {
      log(`(exit code: ${exitCode})`, "#ff8844");
    }
    log("");

    // Update files list after command might have changed something
    await updateFilesList();
  } catch (error: any) {
    log("Error: " + error.message, "#ff4444");
  }
}

async function boot() {
  try {
    log("Booting WebContainer...", "#00d4ff");
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
    log(`Project root: ${rootPath}`, "#888");

    log("Creating project files...", "#00d4ff");

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

    log("Installing shx and Unix tools via library...", "#00d4ff");

    // Check environment
    const envProc = await webcontainer.spawn("jsh", [
      "-c",
      'echo "PATH: $PATH" && echo "CWD: $(pwd)" && ls -la package.json',
    ]);
    envProc.output.pipeTo(
      new WritableStream({
        write(data) {
          log(data.trim(), "#888");
        },
      }),
    );
    await envProc.exit;

    // Use the library's installUnixTools with better logging
    await installUnixTools(
      {
        mount: (tree, opts) => webcontainer.mount(tree, opts),
        spawn: async (cmd, args) => {
          log(`$ ${cmd} ${(args ?? []).join(" ")}`, "#888");
          try {
            const proc = await webcontainer.spawn(cmd, args ?? []);
            proc.output.pipeTo(
              new WritableStream({
                write(data) {
                  if (data.trim()) log(data, "#666");
                },
              }),
            );
            return proc;
          } catch (e: any) {
            log(`Spawn Error [${cmd}]: ${e.message}`, "#ff4444");
            throw e;
          }
        },
      },
      {
        mountPoint: toolsDir,
        overrideBuiltins: true,
      },
    );

    log("Verifying installation...", "#00d4ff");
    const verifyProc = await webcontainer.spawn("jsh", [
      "-c",
      `ls -la ${toolsDir}`,
    ]);
    verifyProc.output.pipeTo(
      new WritableStream({
        write(data) {
          log(data, "#888");
        },
      }),
    );
    await verifyProc.exit;

    // Install wasm-git and mount git wrapper
    log("Installing wasm-git...", "#00d4ff");
    const gitInstallProc = await webcontainer.spawn("jsh", [
      "-c",
      "npm install wasm-git --save-dev",
    ]);
    gitInstallProc.output.pipeTo(
      new WritableStream({
        write(data) {
          if (data.trim()) log(data, "#666");
        },
      }),
    );
    await gitInstallProc.exit;

    // Fetch and mount the git wrapper script
    log("Installing git command...", "#00d4ff");
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

    log(
      "Ready! Unix tools installed: " +
        RECOMMENDED_COMMANDS.join(", ") +
        ", git",
      "#00ff88",
    );
    log("", "#888");

    setStatus("Ready - Unix tools installed", "ready");
    commandInput.disabled = false;
    runButton.disabled = false;

    // Enable quick command buttons
    document
      .querySelectorAll<HTMLButtonElement>(".command-btn")
      .forEach((btn) => {
        btn.disabled = false;
      });

    await updateFilesList();
  } catch (error: any) {
    log("Error: " + error.message, "#ff4444");
    setStatus("Error: " + error.message, "error");
  }
}

// Event handlers
runButton.addEventListener("click", () => {
  runCommand(commandInput.value);
  commandInput.value = "";
});

commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    runCommand(commandInput.value);
    commandInput.value = "";
  }
});

document.querySelectorAll<HTMLButtonElement>(".command-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cmd = btn.getAttribute("data-cmd");
    if (cmd) {
      commandInput.value = cmd;
      runCommand(cmd);
      commandInput.value = "";
    }
  });
});

// Start
boot();
