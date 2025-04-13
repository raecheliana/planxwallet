const fs = require("fs");
const axios = require("axios");
const chalk = require("chalk");
const { HttpsProxyAgent } = require("https-proxy-agent");
const dns = require("dns").promises;

const BASE_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "content-type": "application/json",
  "origin": "https://tg-wallet.planx.io",
  "pragma": "no-cache",
  "priority": "u=1, i",
  "referer": "https://tg-wallet.planx.io/",
  "sec-ch-ua": '"Chromium";v="133", "Microsoft Edge WebView2";v="133", "Not(A:Brand";v="99", "Microsoft Edge";v="133"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0"
};

const TASKS = {
  "m20250212173935519374200019": "Join the PlanX Community",
  "m20250212173935571986800022": "Join the PlanX Channel",
  "m20250212173935594680500028": "Follow PlanX on X",
  "m20250212173935584402900025": "Join the PlanX Discord",
  "m20250212173935604389100031": "Follow PlanX on TikTok",
  "m20250212173935613755700034": "Follow PlanX on YouTube",
  "m20250214173952165258600005": "Repost a PlanX'post on X",
  "m20250213173941632390600015": "Comment a PlanX'post on X",
  "m20250213173941720460300018": "Like a PlanX'post on X",
  "m20250214173952169399300006": "Quote a PlanX' post and tag 3 of friends on X",
  "m20250213173941728955700021": "Share the PlanX video from YouTube to X",
  "m20250213173941736560000024": "Share the PlanX video from TikTok to X",
  "m20250213173941767785900027": "Read the PlanX Medium article",
  "m20250212173935456044700010": "Invite 1 friend",
  "m20250212173935470203200013": "Invite 5 friends",
  "m20250212173935480395100016": "Invite 10 friends"
};

const CALL_URL = "https://mpc-api.planx.io/api/v1/telegram/task/call";
const CLAIM_URL = "https://mpc-api.planx.io/api/v1/telegram/task/claim";

const tokens = fs.readFileSync("tokens.txt", "utf-8")
  .split("\n")
  .map(t => t.trim())
  .filter(Boolean);

const proxies = fs.existsSync("proxy.txt")
  ? fs.readFileSync("proxy.txt", "utf-8")
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean)
  : [];

const config = fs.existsSync("config.json")
  ? JSON.parse(fs.readFileSync("config.json", "utf-8"))
  : {};
const batchSize = config.batch_size || 5;

async function getUsernameFromJWT(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    return (
      payload.username ||
      payload.user_name ||
      payload.nickName ||
      null
    );
  } catch (e) {
    return null;
  }
}

function getConfig(jwt, proxyUrl) {
  return {
    headers: {
      ...BASE_HEADERS,
      token: `Bearer ${jwt}`
    },
    ...(proxyUrl
      ? { httpsAgent: new HttpsProxyAgent(proxyUrl), proxy: false }
      : {})
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resolveProxyToIP(proxyUrl) {
  try {
    const clean = proxyUrl.replace(/^(http:\/\/)?[^@]*@/, "");
    const [host, port] = clean.replace(/^http:\/\//, "").split(":");
    const resolved = await dns.lookup(host);
    return `${resolved.address}:${port}`;
  } catch {
    return proxyUrl;
  }
}

async function processTask(jwt, taskId, taskName, tokenIndex, username, config) {
  const userTag = username ? ` | ${username}` : "";
  try {
    console.log(chalk.cyan(`[${tokenIndex}] 🎲 Rolling Mission:${userTag} - ${taskName}`));
    await axios.post(CALL_URL, { taskId }, config);

    const randomDelay = Math.floor(Math.random() * (30000 - 26000 + 1)) + 26000;
    await delay(randomDelay);

    const res = await axios.post(CLAIM_URL, { taskId }, config);
    if (res.data.success) {
      console.log(chalk.green(`[${tokenIndex}] 🎯 Claimed:${userTag} - ${taskName}`));
    } else {
      console.log(chalk.red(`[${tokenIndex}] ❌ Failed:${userTag} - ${taskName}`));
    }
  } catch (err) {
    if (err.response?.status === 502) {
      console.log(chalk.yellow(`[${tokenIndex}] ⚠️ Retry 502:${userTag} - ${taskName}`));
      await delay(5000);
      return processTask(jwt, taskId, taskName, tokenIndex, username, config);
    }
  }
}

async function claimTasksForToken(jwt, tokenIndex) {
  const proxyUrl = proxies.length > 0 ? proxies[tokenIndex % proxies.length] : null;
  const username = await getUsernameFromJWT(jwt);
  const config = getConfig(jwt, proxyUrl);

  if (proxyUrl) {
    const displayIP = await resolveProxyToIP(proxyUrl);
    console.log(chalk.green(`[${tokenIndex + 1}] 🌐 Proxy ✅ Enabled:`), chalk.gray(displayIP));
  }

  for (const [taskId, taskName] of Object.entries(TASKS)) {
    await processTask(jwt, taskId, taskName, tokenIndex + 1, username, config);
  }
}

async function processInBatches(tokens, batchSize = 1) {
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    console.log(chalk.blue(`\n🚀 Memproses batch ${i / batchSize + 1} (${i + 1}–${i + batch.length})`));

    await Promise.all(
      batch.map((token, idx) => claimTasksForToken(token, i + idx))
    );

    console.log(chalk.green(`✅ Selesai batch ${i / batchSize + 1}\n`));
    if (i + batchSize < tokens.length) {
      console.log(chalk.yellow("⏳ Tunggu 10 detik sebelum batch berikutnya..."));
      await delay(10000);
    }
  }
}

processInBatches(tokens, batchSize);
