import { WebContainer as WebContainerApi } from "@webcontainer/api";

import { installUnixTools, type InstallUnixToolsOptions } from "../unix-tools";
import { FileSystem } from "./file-system";
import { ProcessWrap } from "./process";

export class WebContainer extends FileSystem {
  /** @internal */
  private _instancePromise?: WebContainerApi;

  /** @internal */
  private _isReady: Promise<void>;

  /** @internal */
  private _onExit: (() => Promise<unknown>)[] = [];

  constructor() {
    super();

    this._isReady = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebContainer boot timed out in 30s"));
      }, 30_000);

      WebContainerApi.boot({}).then((instance) => {
        clearTimeout(timeout);
        this._instancePromise = instance;
        resolve();
      });
    });
  }

  /** @internal */
  protected get _instance(): WebContainerApi {
    if (!this._instancePromise) {
      throw new Error(
        "Webcontainer is not yet ready, make sure to call wait() after creation",
      );
    }

    return this._instancePromise;
  }

  /** @internal */
  async wait() {
    await this._isReady;
  }

  /** @internal */
  onServerReady(callback: (options: { port: number; url: string }) => void) {
    this._instance.on("server-ready", (port, url) => {
      callback({ port, url });
    });
  }

  /** @internal */
  async teardown() {
    await Promise.all(this._onExit.map((fn) => fn()));

    // @ts-ignore -- internal
    await this._instance._instance.teardown();

    this._instance.teardown();
    this._instancePromise = undefined;
  }

  /**
   * Run command inside WebContainer.
   * See [`runCommand` documentation](https://github.com/stackblitz/webcontainer-test#runcommand) for usage examples.
   */
  runCommand(
    command: string,
    args: string[] = [],
  ): PromiseLike<string> & ProcessWrap {
    const proc = new ProcessWrap(
      this._instance.spawn(command, args, { output: true }),
    );

    this._onExit.push(() => proc.exit());

    return proc;
  }

  /**
   * Install Unix tools (grep, find, sed, uniq, test, dirs) into WebContainer.
   * Uses shx (ShellJS CLI) for battle-tested implementations.
   *
   * By default, installs recommended commands that WebContainers doesn't have.
   * Use `overrideBuiltins: true` to install commands even if WebContainers has them.
   *
   * @param options - Installation options.
   *
   * @example
   * ```ts
   * // Install recommended commands (grep, find, sed, uniq, test, dirs)
   * await webcontainer.installUnixTools();
   *
   * // Install specific commands only
   * await webcontainer.installUnixTools({ commands: ['grep', 'find'] });
   *
   * // Override WebContainer built-ins with ShellJS versions
   * await webcontainer.installUnixTools({
   *   commands: ['cat', 'head'],
   *   overrideBuiltins: true,
   * });
   *
   * // Use the installed tools
   * const output = await webcontainer.runCommand('grep', ['pattern', 'file.txt']);
   * ```
   */
  async installUnixTools(options: InstallUnixToolsOptions = {}): Promise<void> {
    await installUnixTools(this._instance, options);
  }
}
