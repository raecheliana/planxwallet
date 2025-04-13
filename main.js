const fs = require("fs");
const axios = require("axios");
const chalk = require("chalk");
const { HttpsProxyAgent } = require("https-proxy-agent");

const TASK_IDS = {
  "m20250212173934013124700001": "Default Task",
  "m20250325174288367185100003": "Lottery"
};

const BATCH_SIZE = 3; // Ganti jumlah akun per batch di sini

const tokens = fs.readFileSync("tokens.txt", "utf-8")
  .split("\n")
  .map(t => t.trim())
  .filter(t => t.length > 0);

const proxies = fs.existsSync("proxy.txt")
  ? fs.readFileSync("proxy.txt", "utf-8")
      .split("\n")
      .map(p => p.trim())
      .filter(p => p.length > 0)
  : [];

const headersTemplate = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "origin": "https://tg-wallet.planx.io",
  "referer": "https://tg-wallet.planx.io/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
};

function getAxiosConfigWithProxy(proxyUrl, token) {
  const headers = {
    ...headersTemplate,
    token: `Bearer ${token}`
  };

  if (!proxyUrl) return { headers };

  const agent = new HttpsProxyAgent(proxyUrl);
  return {
    headers,
    httpsAgent: agent,
    proxy: false
  };
}

async function getPublicIP(proxyStr) {
  if (!proxyStr) return "none";
  try {
    const agent = new HttpsProxyAgent(proxyStr);
    const res = await axios.get("https://api.ipify.org?format=json", {
      httpsAgent: agent,
      proxy: false,
      timeout: 5000
    });
    return res.data.ip;
  } catch {
    return "unknown";
  }
}

async function getAccountName(token, proxyStr) {
  const config = getAxiosConfigWithProxy(proxyStr, token);
  try {
    const res = await axios.get("https://mpc-api.planx.io/api/v1/telegram/info", config);
    return res.data?.data?.nickName || "Unknown";
  } catch {
    return "Unknown";
  }
}

async function claimTask(token, index, proxyStr) {
  const config = getAxiosConfigWithProxy(proxyStr, token);
  const username = await getAccountName(token, proxyStr);
  const proxyIP = await getPublicIP(proxyStr);
  const outputLines = [];

  for (const [taskId, taskName] of Object.entries(TASK_IDS)) {
    try {
      const res = await axios.post(
        "https://mpc-api.planx.io/api/v1/telegram/task/claim",
        { taskId },
        config
      );

      if (res.data.success) {
        outputLines.push(
          chalk.green(`[${index}] ✅ Success:`) + ' ' +
          chalk.cyan(username) + ` | ${chalk.magenta(taskName)} | ` +
          chalk.yellow('Proxy IP :') + ' ' + chalk.green(proxyIP)
        );
      } else {
        outputLines.push(
          chalk.red(`[${index}] ❌ Failed:`) + ' ' +
          chalk.cyan(username) + ` | ${chalk.magenta(taskName)} | ` +
          chalk.yellow('Proxy IP :') + ' ' + chalk.green(proxyIP)
        );
      }
    } catch {
      outputLines.push(
        chalk.red(`[${index}] ❌ Error:`) + ' ' +
        chalk.cyan(username) + ` | ${chalk.magenta(taskName)} | ` +
        chalk.yellow('Proxy IP :') + ' ' + chalk.green(proxyIP)
      );
    }

    await new Promise(res => setTimeout(res, 1000)); // delay antar task
  }

  return outputLines;
}

async function processAllTokens() {
  let batchCount = 1;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);
    console.log(chalk.blue(`\n🚀 Mulai Batch ${batchCount} [${batchTokens.length} akun]`));

    const results = await Promise.all(
      batchTokens.map((token, j) => {
        const index = i + j + 1;
        const proxy = proxies[(i + j) % proxies.length];
        return claimTask(token, index, proxy);
      })
    );

    results.forEach(lines => {
      lines.forEach(line => console.log(line));
      console.log(); // newline antar akun
    });

    console.log(chalk.green(`✅ Selesai Batch ${batchCount}\n`));
    batchCount++;
    await new Promise(resolve => setTimeout(resolve, 1500)); // delay antar batch
  }
}

async function loopEvery3Hours5Minutes() {
  while (true) {
    console.log(chalk.blue(`\n⏳ Mulai klaim semua akun... [${new Date().toLocaleString()}]`));
    await processAllTokens();

    const delayMs = 185 * 60 * 1000; // 3 jam 5 menit
    for (let sisa = delayMs / 1000; sisa > 0; sisa--) {
      process.stdout.write(`\r⏱️  Menunggu ${Math.floor(sisa / 60)}m ${sisa % 60}s sebelum loop ulang...`);
      await new Promise(res => setTimeout(res, 1000));
    }
    console.log(); // newline setelah countdown
  }
}

loopEvery3Hours5Minutes();
