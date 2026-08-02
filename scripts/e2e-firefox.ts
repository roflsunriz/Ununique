import { spawn, type ChildProcess } from "node:child_process";
import { connect as connectSocket, createServer, type Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type MarionetteResponse = [number, number, unknown, unknown];

const extensionArchive = "web-ext-artifacts/ununique.xpi";
const firefoxBinary =
  process.env.FIREFOX_BINARY ??
  (process.platform === "win32" ? "C:/Program Files/Mozilla Firefox/firefox.exe" : "firefox");

const profileDirectory = await mkdtemp(join(tmpdir(), "ununique-firefox-e2e-"));
const marionettePort = await findFreePort();
const pageServer = Bun.serve({
  port: 0,
  fetch() {
    return new Response("<!doctype html><title>Ununique E2E</title>", {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
});

let firefox: ChildProcess | undefined;
let client: MarionetteClient | undefined;
const firefoxErrors: string[] = [];

try {
  firefox = spawn(
    firefoxBinary,
    [
      "-no-remote",
      "-headless",
      "-marionette",
      "--marionette-port",
      String(marionettePort),
      "-profile",
      profileDirectory,
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
  );
  firefox.stderr?.on("data", (data: Buffer) => {
    firefoxErrors.push(data.toString("utf8"));
  });

  await waitForPort(marionettePort, firefox);
  client = await MarionetteClient.connect(marionettePort);
  await client.request("WebDriver:NewSession", {
    capabilities: { alwaysMatch: { browserName: "firefox" } }
  });

  const addon = await Bun.file(extensionArchive).arrayBuffer();
  await client.request("WebDriver:InstallAddon", {
    addon: Buffer.from(addon).toString("base64"),
    temporary: true
  });

  await client.request("WebDriver:Get", { url: `http://127.0.0.1:${pageServer.port}/` });
  const values = await waitForProtectedPage(client);

  assert(values.platform === "Win32", `navigator.platform was ${values.platform}`);
  assert(values.language === "en-US", `navigator.language was ${values.language}`);
  assert(values.languages.join(",") === "en-US,en", `navigator.languages was ${values.languages}`);
  assert(
    values.userAgent.includes("Windows NT 10.0"),
    "User-Agent did not use the normalized platform"
  );
  assert(values.screenWidth % 100 === 0, `screen.width was not bucketed: ${values.screenWidth}`);
  assert(values.screenHeight % 100 === 0, `screen.height was not bucketed: ${values.screenHeight}`);
  assert(values.timezoneOffset === 0, `timezone offset was ${values.timezoneOffset}`);
  assert(values.timezone === "UTC", `resolved timezone was ${values.timezone}`);
  assert(values.changedCanvasPixels > 0, "Canvas pixels were not masked");

  console.log(
    JSON.stringify(
      {
        browser: "Firefox",
        addon: "temporary",
        page: "protected",
        platform: values.platform,
        language: values.language,
        screen: `${values.screenWidth}x${values.screenHeight}`,
        timezone: values.timezone,
        changedCanvasPixels: values.changedCanvasPixels
      },
      null,
      2
    )
  );
} finally {
  try {
    await client?.request("WebDriver:DeleteSession", {});
  } catch {
    // The browser may already have exited after a failed assertion.
  }
  client?.close();
  if (firefox) {
    await stopFirefox(firefox);
  }
  pageServer.stop(true);
  try {
    await rm(profileDirectory, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Could not remove temporary Firefox profile: ${String(error)}`);
  }
}

interface ProtectedPageValues {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  screenWidth: number;
  screenHeight: number;
  timezoneOffset: number;
  timezone: string;
  changedCanvasPixels: number;
}

async function waitForProtectedPage(marionette: MarionetteClient): Promise<ProtectedPageValues> {
  const script = `return (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is unavailable");
    context.fillStyle = "rgb(128, 128, 128)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let changedCanvasPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] !== 128 || data[index + 1] !== 128 || data[index + 2] !== 128) {
        changedCanvasPixels += 1;
      }
    }
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: [...navigator.languages],
      screenWidth: screen.width,
      screenHeight: screen.height,
      timezoneOffset: new Date().getTimezoneOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      changedCanvasPixels
    };
  })();`;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await marionette.request("WebDriver:ExecuteScript", {
        script,
        args: []
      });
      const value = getResponseValue(response) as ProtectedPageValues;
      if (value.platform === "Win32" && value.language === "en-US") {
        return value;
      }
    } catch {
      // The content script can still be waiting for the background response.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("The extension did not apply its page protection within 7.5 seconds.");
}

class MarionetteClient {
  private constructor(private readonly socket: Socket) {}

  private nextId = 0;
  private buffer = Buffer.alloc(0);
  private pending = new Map<number, (response: MarionetteResponse) => void>();

  static async connect(port: number): Promise<MarionetteClient> {
    const socket = await new Promise<Socket>((resolve, reject) => {
      const connection = connectSocket({ host: "127.0.0.1", port });
      connection.once("connect", () => resolve(connection));
      connection.once("error", reject);
    });
    const client = new MarionetteClient(socket);
    await client.waitForHello();
    return client;
  }

  request(command: string, parameters: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const packet = JSON.stringify([0, id, command, parameters]);
    this.socket.write(`${Buffer.byteLength(packet, "utf8")}:${packet}`);
    return new Promise((resolve, reject) => {
      this.pending.set(id, (response) => {
        if (response[2]) {
          reject(new Error(JSON.stringify(response[2])));
          return;
        }
        resolve(response[3]);
      });
    });
  }

  close(): void {
    this.socket.end();
  }

  private waitForHello(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.on("data", (data: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        while (true) {
          const message = this.readMessage() as
            MarionetteResponse | { applicationType?: string } | undefined;
          if (!message) {
            break;
          }
          if (!Array.isArray(message) && message.applicationType === "gecko") {
            resolve();
            this.socket.removeAllListeners("data");
            this.socket.on("data", (nextData: Buffer) => this.handleData(nextData));
            this.handleData(Buffer.alloc(0));
            return;
          }
        }
      });
      this.socket.on("error", reject);
    });
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (true) {
      const message = this.readMessage() as MarionetteResponse | undefined;
      if (!message) {
        return;
      }
      if (Array.isArray(message) && message[0] === 1) {
        const callback = this.pending.get(message[1]);
        this.pending.delete(message[1]);
        callback?.(message);
      }
    }
  }

  private readMessage(): unknown | undefined {
    const separator = this.buffer.indexOf(58);
    if (separator < 1) {
      return undefined;
    }
    const length = Number(this.buffer.subarray(0, separator).toString("ascii"));
    if (!Number.isInteger(length) || this.buffer.length < separator + 1 + length) {
      return undefined;
    }
    const start = separator + 1;
    const message = JSON.parse(
      this.buffer.subarray(start, start + length).toString("utf8")
    ) as unknown;
    this.buffer = this.buffer.subarray(start + length);
    return message;
  }
}

function getResponseValue(response: unknown): unknown {
  if (!response || typeof response !== "object" || !("value" in response)) {
    return response;
  }
  return (response as { value: unknown }).value;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Could not find a free TCP port.");
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForPort(port: number, firefoxProcess?: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (firefoxProcess?.exitCode !== null && firefoxProcess?.exitCode !== undefined) {
      throw new Error(
        `Firefox exited before opening Marionette port ${port} (code ${firefoxProcess.exitCode}). ${firefoxErrors.join("")}`
      );
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = connectSocket({ host: "127.0.0.1", port });
        socket.once("connect", () => {
          socket.end();
          resolve();
        });
        socket.once("error", reject);
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
  }
  throw new Error(`Firefox did not open Marionette port ${port}. ${firefoxErrors.join("")}`);
}

async function stopFirefox(firefoxProcess: ChildProcess): Promise<void> {
  if (firefoxProcess.exitCode !== null) {
    return;
  }

  const exited = new Promise<void>((resolve) => {
    firefoxProcess.once("exit", () => resolve());
  });
  firefoxProcess.kill();
  await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);

  if (firefoxProcess.exitCode === null && process.platform === "win32" && firefoxProcess.pid) {
    const taskkill = spawn("taskkill", ["/PID", String(firefoxProcess.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    await new Promise<void>((resolve) => taskkill.once("exit", () => resolve()));
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Firefox E2E assertion failed: ${message}`);
  }
}
