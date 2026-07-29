import { spawn } from "node:child_process";

const port = Number(process.env.PORT || "3316");
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitUntilReady() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`production server exited early\n${output}`);
    try {
      const response = await fetch(`${origin}/login`);
      if (response.ok) return response.text();
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`production server did not become ready\n${output}`);
}

try {
  const loginHtml = await waitUntilReady();
  const root = await fetch(`${origin}/`);
  if (!root.ok) throw new Error(`root returned ${root.status}`);
  const planner = await fetch(`${origin}/berth-planner`, { redirect: "manual" });
  if (planner.status !== 307 || !planner.headers.get("location")?.startsWith("/login")) {
    throw new Error(`protected planner route returned ${planner.status}`);
  }
  const assetPath = loginHtml.match(/\/_next\/static\/[^"' ]+\.(?:css|js|woff2)/)?.[0];
  if (!assetPath) throw new Error("login page did not reference a static asset or font");
  const asset = await fetch(`${origin}${assetPath}`);
  if (!asset.ok || !(await asset.arrayBuffer()).byteLength) throw new Error(`static asset returned ${asset.status}`);
  console.log("[production-smoke] PASS: root, login, protected planner redirect, and static asset");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", resolve);
    setTimeout(resolve, 3_000);
  });
}
