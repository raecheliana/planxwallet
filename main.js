const fs = require("fs");
const axios = require("axios");

const TASK_ID = "m20250212173934013124700001";

const tokens = fs.readFileSync("tokens.txt", "utf-8")
  .split("\n")
  .map(t => t.trim())
  .filter(t => t.length > 0);

const headersTemplate = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "origin": "https://tg-wallet.planx.io",
  "referer": "https://tg-wallet.planx.io/",
  "user-agent": "Mozilla/5.0"
};

async function claimTask(token, index) {
  const headers = { ...headersTemplate, token: `Bearer ${token}` };

  try {
    const res = await axios.post(
      "https://mpc-api.planx.io/api/v1/telegram/task/claim",
      { taskId: TASK_ID },
      { headers }
    );

    if (res.data.success) {
      console.log(`[${index}] ✅ Claimed: ${res.data.msg}`);
    } else {
      console.log(`[${index}] ❌ Failed to claim: ${res.data.msg}`);
    }
  } catch (err) {
    console.log(`[${index}] ❌ Error: ${err.message}`);
  }
}

async function processAllTokens() {
  for (let i = 0; i < tokens.length; i++) {
    await claimTask(tokens[i], i + 1);
    await new Promise(resolve => setTimeout(resolve, 1000)); // jeda antar akun
  }
}

processAllTokens();
