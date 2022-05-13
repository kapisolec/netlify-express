import express from "express";
import QueryHelper from "./Scripts/QueryHelper.js";
import bodyParser from "body-parser";
import fs from "fs";
import cors from "cors";
import chalk from "chalk";
import axios from "axios";
import "dotenv/config";
import { utils } from "ethers";

const tokenInfoPath = "./data/tokenInfo.json";
const walletsInfoPath = "./data/walletsInfo.json";
const tasksPath = "./data/tasks.json";
const rewardsPath = "./data/rewardsAggregated.json";

const helper = new QueryHelper(
  "ws://23.88.66.251:8546",
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  "0xe9e7cea3dedca5984780bafc599bd69add087d56",
  "0x10ED43C718714eb63d5aA57B78B54704E256024E"
);

const transferCb = (wallet, amount) => {
  //rewards aggregating and propagation logic
  const rewardsAggregated = JSON.parse(fs.readFileSync(rewardsPath));
  const value = Number(amount);
  if (rewardsAggregated[wallet]) {
    rewardsAggregated[wallet] += value;
  } else {
    rewardsAggregated[wallet] = value;
  }
  rewardsAggregated[wallet] = parseFloat(rewardsAggregated[wallet].toFixed(9));

  // fs.writeFileSync(rewardsPath, JSON.stringify(rewardsAggregated));
};

helper.updateNativeTokenPrice();
helper.listenForNewTransfers(
  "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  "from",
  transferCb
);

const app = express();
const port = 3001;

const getTime = () => {
  let h = new Date().getHours();
  let m = new Date().getMinutes();
  let s = new Date().getSeconds();

  setTimeout(() => {}, 1500);

  h = h < 10 ? "0" + h : h;
  m = m < 10 ? "0" + m : m;
  s = s < 10 ? "0" + s : s;

  const output = h + ":" + m + ":" + s;
  return output;
};

app.use(bodyParser.json());
app.use(cors({ methods: "*", origin: "*" }));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// routes
app.get("/", (req, res) => res.send("Hello World!"));

// setInterval(() => {
//   axios.post('')
// }, 3600000);

app.post("/rpc", async function (req, res) {
  const { method, params } = req.body;
  console.log(
    chalk.greenBright(
      ` \n    ${chalk.magentaBright(
        getTime()
      )} | New remote call from ID: ${chalk.cyanBright(
        req.ip
      )}, with method of ${chalk.underline(chalk.cyan(method))} \n`
    )
  );

  if (!method) {
    return res.status(404).json("Parameters method not provided");
  }

  if (method === "forceGenerateRaport" && params) {
    try {
      const { token, nativeToken, nativeTokenValInUSD, intervals } = params;
      if (!token || !intervals) {
        return res.status(404).json("Token or intervals not provided");
      }

      const results = await helper.generateRaport(
        token,
        nativeToken || undefined,
        nativeTokenValInUSD || 1,
        intervals
      );

      // const holders = await helper.getHolders(token);

      fs.writeFileSync(tokenInfoPath, JSON.stringify({ ...results }));

      return res.status(200).json(results);
    } catch (error) {
      console.error(error);
      return res.status(404).send(error);
    }
  }

  if (
    method === "getTradingVolume" ||
    (method === "getTradingVolumes" && params)
  ) {
    try {
      const raport = JSON.parse(fs.readFileSync(tokenInfoPath)).tradingVolumes;
      return res.status(200).json(raport);
    } catch (error) {
      console.error(error);
      return res.status(404).send(error);
    }
  }

  if (method === "getTokenInfo" && params) {
    try {
      const { token, nativeToken, wallet = null } = params;
      const tokenInfo = await helper.getTokenInfo(
        token,
        nativeToken || undefined
      );
      if (wallet != null) {
        const userData = await helper.getUserInfo(wallet, token);
        return res.status(200).json({ ...tokenInfo, ...userData });
      } else {
        return res.status(200).json(tokenInfo);
      }
    } catch (error) {
      console.error(error);
      return res.status(404).send(error);
    }
  }

  // if anything else
  res.json({
    "Available methods": [
      "getTradingVolume(s)",
      "forceGenerateRaport",
      "getTokenInfo",
    ],
  });
});

app.post("/registerTask", async (req, res) => {
  try {
    const { wallet, task } = req.body;
    const object = JSON.parse(fs.readFileSync(walletsInfoPath));
    const currentWallets = object.wallets;

    if (currentWallets[wallet]) {
      if (currentWallets[wallet][task]) {
        return res.status(200).send("Task already created");
      }
    } else {
      currentWallets[wallet] = {};
    }

    currentWallets[wallet][task] = false;
    fs.writeFileSync(walletsInfoPath, JSON.stringify({ ...object }));
    return res.status(200).send(true);
  } catch (error) {
    console.error(error);
    return res.status(400).send(JSON.stringify(error));
  }
});

app.post("/getDoneTasks", async (req, res) => {
  try {
    const { wallet } = req.body;
    const object = JSON.parse(fs.readFileSync(walletsInfoPath));
    const tasks = object.wallets;
    return res.status(200).send(tasks[wallet]);
  } catch (error) {
    console.error(error);
    return res.status(400).send(JSON.stringify(error));
  }
});

app.get("/get-leaderboard", async (req, res) => {
  try {
    const object = JSON.parse(fs.readFileSync(rewardsPath));
    //sort by highest reward

    //array of objects
    const arrOfObjs = Object.entries(object).map(([k, v]) => ({ [k]: v }));
    const sorted = arrOfObjs.sort(
      (a, b) => Object.values(b)[0] - Object.values(a)[0]
    );

    return res.status(200).send(sorted);
  } catch (error) {
    console.error(error);
    return res.status(400).send(JSON.stringify(error));
  }
});
