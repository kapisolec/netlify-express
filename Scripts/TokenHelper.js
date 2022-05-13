import { ethers } from "ethers";
import QueryHelper from "./QueryHelper.js";

export default class TgBot extends QueryHelper {
  constructor(endpoint, nativeToken, nativeUSDToken, router) {
    super(endpoint, nativeToken, nativeUSDToken, router);
  }

  listenForNewTokenTxs = (cb) => {
    console.log("starting listeners...");
    this.provider.on("pending", async (tx) => {
      const transaction = await this.provider.getTransaction(tx);
      if (transaction !== null && transaction.to === null) {
        try {
          const tx = await this.provider.waitForTransaction(transaction.hash);
          console.log(`TOKEN ADDRESS => ${tx.contractAddress}`);
          const tokenObj = await this.getTokenData(tx.contractAddress, tx.from);

          const deployedTokens = await this.getDeployedContractsData(
            transaction.from
          );

          cb({ tokenObj: tokenObj, deployedTokens: deployedTokens });
        } catch (error) {
          console.log(error);
        }
      }
    });
  };

  getTokenData = async (token, deployer = "") => {
    const tokenObj = {};
    try {
      if (!token) return;

      const tokenContract = new ethers.Contract(
        token,
        this.tokenABI,
        this.provider
      );

      tokenObj.token = token;
      tokenObj.name = await tokenContract.name();
      tokenObj.symbol = await tokenContract.symbol();
      tokenObj.decimals = await tokenContract.decimals();
      tokenObj.totalSupply = await tokenContract.totalSupply();

      //there are differnet functions for getting an owner
      if (deployer === "") {
        try {
          tokenObj.owner = await tokenContract.owner();
        } catch (error) {
          tokenObj.owner = await tokenContract.getOwner();
        }
      } else {
        tokenObj.owner = deployer;
      }

      tokenObj.walletBalance = await this.provider.getBalance(tokenObj.owner);

      return tokenObj;
    } catch (error) {
      console.log(error);
      return tokenObj;
    }
  };

  getDeployedContractsData = async (wallet) => {
    const contractsLogs = await this.getFilteredQuery(700, 150000, 3, [
      ethers.utils.id("Transfer(address,address,uint256)"),
      ethers.utils.hexZeroPad("0x", 32),
      ethers.utils.hexZeroPad(wallet, 32),
    ]);

    const tokenList = contractsLogs.map(async (log) => {
      try {
        const receipt = await this.provider.waitForTransaction(
          log.transactionHash
        );

        const contractAddress = receipt?.contractAddress;
        const tokenObj = this.getTokenData(contractAddress);
        return tokenObj;
      } catch (error) {
        console.log(error);
      }
    });

    const promiseRes = await Promise.all(tokenList);
    return promiseRes;
  };

  getTxReceipt = (txHash) => {
    this.provider
      .getTransactionReceipt(txHash)
      .then((receipt) => console.log(receipt));
  };
}
