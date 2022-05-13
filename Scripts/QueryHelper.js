import { BigNumber, ethers } from "ethers";
import { tokenABI, factoryABI } from "./ABI.js";
import fs from "fs";
import axios from "axios";
import "dotenv/config";

const _filterOutOnKey = (arrOfObjects, key) => {
  const seen = {};
  const array = [];
  arrOfObjects.forEach((el) => {
    if (!seen[el[key]]) {
      seen[el[key]] = 1;
      array.push(el);
    }
  });
  return array;
};

export default class QueryHelper {
  constructor(
    endpoint = "ws://23.88.66.251:8549",
    nativeToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    nativeUSDToken = "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    router = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"
  ) {
    this._initialize(endpoint, nativeToken, nativeUSDToken, router);
    this.tokenABI = tokenABI;
    this.factoryABI = factoryABI;
  }

  _initialize = (
    endpoint = "ws://23.88.66.251:8549",
    nativeToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    nativeUSDToken = "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    router = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"
  ) => {
    this.endpoint = endpoint;
    this.nativeToken = nativeToken;
    this.nativeUSDToken = nativeUSDToken;
    this.router = router;
    this.signer = new ethers.Wallet(process.env.PRV_KEY);
    this.nativeTokenPrice = 1;
    try {
      this.provider = new ethers.providers.WebSocketProvider(this.endpoint);
      this.signer = this.signer.connect(this.provider);
    } catch (error) {
      console.error(error);
    }
  };

  setInitializers = (endpoint, nativeToken, nativeUSDToken, router) => {
    this._initialize(endpoint, nativeToken, nativeUSDToken, router);
  };

  updateNativeTokenPrice = async () => {
    this.getTokenInfo(this.nativeToken, this.nativeUSDToken)
      .then((obj) => (this.nativeTokenPrice = obj.pricePerToken))
      .catch((err) => {});
  };

  listenForNewTransfers = async (
    address = this.router,
    mode = "to",
    cb = () => {}
  ) => {
    let topicSets = [];
    if (mode == "to") {
      topicSets = [
        ethers.utils.id("Transfer(address,address,uint256)"),
        null,
        ethers.utils.hexZeroPad(address, 32),
      ];
    } else if (mode == "from") {
      topicSets = [
        ethers.utils.id("Transfer(address,address,uint256)"),
        ethers.utils.hexZeroPad(address, 32),
        null,
      ];
    } else {
      return console.log(new Error("Wrong mode"));
    }

    this.provider.on(topicSets, async (log, event) => {
      // Emitted any token is sent TO either address
      try {
        const tx = await this.provider.getTransaction(log.transactionHash);
        if (tx.value) {
          const value = Number(ethers.utils.formatEther(tx.value));
          const { from, to } = tx;
          cb(to, value);
        }
      } catch (error) {
        console.log(error);
      }
    });
  };

  getPair = async (tokenA, tokenB) => {
    const routerContract = new ethers.Contract(
      this.router,
      this.tokenABI,
      this.provider
    );
    const factory = await routerContract.factory();

    const factoryContract = new ethers.Contract(
      factory,
      this.factoryABI,
      this.provider
    );

    const pair = await factoryContract.getPair(tokenA, tokenB);
    return pair;
  };

  getTokenInfo = async (token, nativeToken = this.nativeToken) => {
    const holders = JSON.parse(
      fs.readFileSync("./data/tokenInfo.json")
    ).holders;

    const pair = await this.getPair(token, nativeToken);

    const tokenContract = new ethers.Contract(
      token,
      this.tokenABI,
      this.provider
    );
    const nativeTokenContract = new ethers.Contract(
      nativeToken,
      this.tokenABI,
      this.provider
    );

    try {
      const balanceOfToken = await tokenContract.balanceOf(pair);
      const tokenDecimals = await tokenContract.decimals();
      const balanceOfNativeToken = await nativeTokenContract.balanceOf(pair);
      const nativeTokenDecimals = await nativeTokenContract.decimals();
      const supply = await tokenContract.totalSupply();

      const liquidity =
        (balanceOfNativeToken / 10 ** nativeTokenDecimals) *
        this.nativeTokenPrice;

      const pricePerToken = liquidity / (balanceOfToken / 10 ** tokenDecimals);

      const marketCap = (supply / 10 ** tokenDecimals) * pricePerToken;

      return {
        timestamp: new Date().getTime(),
        pricePerToken,
        marketCap,
        liquidity,
        holders,
      };
    } catch (error) {
      return console.error(error);
    }
  };

  getTradingVolume = async (token, interval = 24) => {
    const maxBlocks = interval < 4 ? interval * 60 * 20 : 5000;
    const iterations = Math.ceil((interval * 60 * 20) / maxBlocks);

    const tokenContract = new ethers.Contract(
      token,
      this.tokenABI,
      this.provider
    );

    const currentBlock = await this.provider.getBlockNumber();
    const allResults = [];

    const pair = await this.getPair(token, this.nativeToken);

    const filterToRouter = tokenContract.filters.Transfer(pair, null);
    const filterFromRouter = tokenContract.filters.Transfer(null, pair);

    for (let index = 0; index < iterations; index++) {
      allResults.push(
        ...(await tokenContract.queryFilter(
          filterFromRouter,
          currentBlock - maxBlocks * index - maxBlocks,
          currentBlock - maxBlocks * index
        ))
      );

      allResults.push(
        ...(await tokenContract.queryFilter(
          filterToRouter,
          currentBlock - maxBlocks * index - maxBlocks,
          currentBlock - maxBlocks * index
        ))
      );
    }

    const value = allResults.reduce((acc, cur) => {
      return acc.add(cur.args.amount);
    }, BigNumber.from(0));

    const { pricePerToken } = await this.getTokenInfo(token, this.nativeToken);

    const decimals = await tokenContract.decimals();
    const divisionFactor = (10 ** decimals).toString();

    const volume = value.div(divisionFactor).toNumber() * pricePerToken;

    console.log("VOLUME TRADED -> " + volume);

    return {
      timestamp: new Date().getTime(),
      volume: volume,
    };
  };

  getFilteredQuery = async (
    interval = 72,
    defaultMaxBlocks = 5000,
    blockTime = 3,
    filter = []
  ) => {
    try {
      const allResults = [];
      const maxBlocks =
        interval < 4 ? interval * 60 * (60 / blockTime) : defaultMaxBlocks;
      const iterations = Math.ceil(
        (interval * 60 * (60 / blockTime)) / maxBlocks
      );
      const currentBlock = await this.provider.getBlockNumber();

      for (let index = 0; index < iterations; index++) {
        allResults.push(
          ...(await this.provider.getLogs({
            fromBlock: currentBlock - maxBlocks * index - maxBlocks,
            toBlock: currentBlock - maxBlocks * index,
            topics: filter,
          }))
        );
      }

      const results = _filterOutOnKey(allResults, "transactionHash");

      // returns array of objects of each transaction
      return results;
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  getUserInfo = async (address, token) => {
    const tokenContract = new ethers.Contract(
      token,
      this.tokenABI,
      this.provider
    );

    const decimals = await tokenContract.decimals();
    const tokenInfo = await this.getTokenInfo(token);
    const balanceOfToken =
      (await tokenContract.balanceOf(address)) / 10 ** decimals;
    const valueOfToken = balanceOfToken * tokenInfo.pricePerToken;

    return { balanceOfToken, valueOfToken };
  };

  getNativeTokenBalance = async (address) => {
    const balance = ethers.FixedNumber.from(
      await this.provider.getBalance(address)
    );
    return balance.toUnsafeFloat() / 10 ** 18;
  };

  sendOutRewards = async (contractAddress, wallets, rewards, value) => {
    const rewardsContract = new ethers.Contract(
      contractAddress,
      this.tokenABI,
      this.signer
    );
    try {
      const returnVal = await rewardsContract.setRewards(wallets, rewards, {
        value: ethers.utils.parseEther(String(value)),
      });
      console.log(returnVal);
    } catch (error) {
      console.log(error);
    }
  };

  getHolders = async (token) => {
    try {
      const results = await axios.get(`https://api.bscscan.com/api
      ?module=token
      &action=tokeninfo
      &contractaddress=${ethers.utils.getAddress(token)}
      &apikey=TBWCEB2BQB5M4BZU3CDZ77I1EUC1CRZTYV`);

      return results;
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  generateRaport = async (
    token,
    nativeToken = this.nativeToken,
    nativeTokenValInUSD = 1,
    intervals
  ) => {
    const tokenInfoObj = await this.getTokenInfo(
      token,
      nativeToken,
      nativeTokenValInUSD
    );
    const tradingVolumes = {};

    const tradingVolumesPromises = intervals.map(async (interval) => ({
      [interval]: await this.getTradingVolume(token, interval),
    }));

    const results = await Promise.all(tradingVolumesPromises);

    results.forEach(
      (obj) =>
        (tradingVolumes[Object.keys(obj)[0] + "h"] = Object.values(obj)[0])
    );

    return {
      tokenInfoObj: tokenInfoObj,
      tradingVolumes: tradingVolumes,
      timestamp: new Date().getTime(),
    };
  };
}
