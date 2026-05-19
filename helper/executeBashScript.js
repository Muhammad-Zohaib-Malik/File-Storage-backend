import { spawn } from "child_process";

export const executeBashScript = (scriptPath, label) => {
  const process = spawn("bash", [scriptPath]);

  process.stdout.on("data", (data) => {
    process.stdout.write(`[${label}] ${data}`);
  });

  process.stderr.on("data", (data) => {
    process.stderr.write(`[${label} ERROR] ${data}`);
  });

  process.on("close", (code) => {
    if (code === 0) {
      console.log(`✅ ${label} deployment successful`);
    } else {
      console.error(`❌ ${label} deployment failed (code ${code})`);
    }
  });

  process.on("error", (err) => {
    console.error(`❌ ${label} spawn error`, err);
  });
};
