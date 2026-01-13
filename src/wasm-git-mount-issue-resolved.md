# Debugging Wasm-Git Integration Walkthrough

We successfully fixed the `wasm-git` integration in the WebContainer playground. The issue was that git commands were running in an isolated WASM memory filesystem and failing security checks.

## Changes Made

### [playground/git-wrapper.js](file:///Users/Tom/projects/webcontainer-unix-cmds/webcontainer-test-add-posix-commands/playground/git-wrapper.js)
We modified the git wrapper script to perform two critical setup steps before running any git command:

1.  **Filesystem Mounting**:
    -   We detected the `NODEFS` filesystem type in the Emscripten environment.
    -   We mounted the host's current working directory (`process.cwd()`) to `/mnt` inside the WASM environment.
    -   This allows `git` to see and modify the actual files in the WebContainer.

2.  **Ownership Check Bypass**:
    -   Because the user running the WASM process (often emulated or root) differs from the host filesystem owner, `git` (specifically `libgit2`) blocked access with a "safe directory" error (CVE-2022-24765).
    -   We resolved this by manually writing a `.gitconfig` file to `/home/web_user/.gitconfig` with the content:
        ```ini
        [safe]
        directory = *
        ```
    -   This tells git to trust all directories, bypassing the ownership check.

## Verification
The changes were verified by running:
-   `git init .`: Successfully initializes a repo.
-   `ls -la .git`: Confirms the `.git` directory is created on the host filesystem.
-   `git status`: correctly reports the status of the repository.

Note: The output `Initialized empty Git repository in /mnt/` refers to the internal WASM path, which maps correctly to the current directory on the host.
