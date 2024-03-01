'use strict';

var constants = require('./constants');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const Web3 = require('web3');
const privateKey = process.env.PRIVATE_KEY;
const swapPercent = parseFloat(process.env.SWAP_PERCENT);

const url_matic = 'https://rpc-mainnet.maticvigil.com';
const web3 = new Web3(url_matic);

const BN = web3.utils.BN;

async function run(event, context) {
  const time = new Date();
  console.log(`Your cron function "${context.functionName}" ran at ${time}`);

  let address = web3.eth.accounts.privateKeyToAccount(privateKey).address;

  // get pKlima Balance
  try {
    let pklimaBalance = await getPKlimaBalance(address);
    console.log(`PKLIMA balance: ${pklimaBalance}`);
  }
  catch (error) {
    console.log(`getting PKLIMA balance error: ${error}`);
  }

  // get BCT Balance
  let bctBalance;
  try {
    bctBalance = await getBCTBalance(address);
    console.log(`BCT balance: ${bctBalance}`);
  }
  catch (error) {
    console.log(`getting BCT balance error: ${error}`);
  }

  // get vesting share
  try {
    let vestingShare = await getVestingShare(address);
    console.log(`VestingShare: ${vestingShare}%`);
  }
  catch (error) {
    console.log(`getting Vesting Share error: ${error}`);
  }

  // get vestable amount
  let vestableAmount = 0;
  try {
    vestableAmount = await getReemable(address);
    console.log(`Vestable Amount: ${vestableAmount}`);
  }
  catch (error) {
    console.log(`getting VestableAmount error: ${error}`);
  }

  // exercise and claim KLIMA
  let claimedAmount = 0;
  try {
    if (vestableAmount > bctBalance) {
      console.log("WARNING: vestable amount > BCT balance. Purchase more BCT.");
      vestableAmount = bctBalance;
    }
    let result = await exercise(privateKey, vestableAmount);
    claimedAmount = vestableAmount;

    console.log(`exercise receipt: ${JSON.stringify(result)}`);
  }
  catch (error) {
    console.log(`claiming error: ${error}`);
  }

  // try to sell small amount of BCT
  try {
    if (claimedAmount == 0) {
      console.log("no claimed KLIMA");
    }
    else {
      let swapAmount = claimedAmount * swapPercent / 100;

      if (swapAmount >= 0.1) {
        await sellTokenOnSushiSwap(
          privateKey,
          constants.KLIMA_ABI,
          constants.KLIMA_ADDRESS,
          swapAmount
        );
        console.log("swap finished");
      }
    }
  }
  catch (error) {
    console.log(`selling error: ${error}`);
  }
};

/// get PKLIMA balance in the wallet of 'address'
async function getPKlimaBalance(address) {

  const token = new web3.eth.Contract(constants.PKLIMA_ABI, constants.PKLIMA_ADDRESS);

  let result = await token.methods.balanceOf(address).call();

  return web3.utils.fromWei(result);
};

/// get BCT balance in the wallet of 'address'
async function getBCTBalance(address) {

  const token = new web3.eth.Contract(constants.BCT_ABI, constants.BCT_ADDRESS);

  let result = await token.methods.balanceOf(address).call();

  return web3.utils.fromWei(result);
};

/// get Redeemable in the wallet of 'address'
async function getVestingShare(address) {

  const contract = new web3.eth.Contract(constants.EXERCISE_PKLIMA_ABI, constants.EXERCISE_PKLIMA_ADDRESS);

  let result = await contract.methods.terms(address).call();

  return result.percent / 10000;
}

async function getReemable(address) {

  const contract = new web3.eth.Contract(constants.EXERCISE_PKLIMA_ABI, constants.EXERCISE_PKLIMA_ADDRESS);

  let result = await contract.methods.redeemableFor(address).call();

  return web3.utils.fromWei(result);
}

async function exercise(privateKey, amountInEther) {

  let account = web3.eth.accounts.privateKeyToAccount(privateKey);

  const contract = new web3.eth.Contract(constants.EXERCISE_PKLIMA_ABI, constants.EXERCISE_PKLIMA_ADDRESS);

  let amountInWei = web3.utils.toWei(amountInEther.toString(), 'ether');

  const transaction = contract.methods.exercise(amountInWei);

  let estimatedGas = await transaction.estimateGas({from: account.address});

  const options = {
    to: transaction._parent._address,
    gas: estimatedGas * 2, //sometimes estimate is wrong and we don't care if more gas is needed
    data: transaction.encodeABI(),
  };

  const signed = await web3.eth.accounts.signTransaction(options, privateKey);
  const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

  return receipt;
}

async function buyUSDCWithToken(privateKey, tokenAbi, tokenAddress, amountTokenInNative) {

  let account = web3.eth.accounts.privateKeyToAccount(privateKey);

  let tokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);

  let decimals = await tokenContract.methods.decimals().call();

  let swapContract = new web3.eth.Contract(constants.SUSHISWAP_ROUTER_ABI, constants.SUSHISWAP_ROUTER_ADDRESS);

  let tokenAmountToSwap = convertNativeAmountWithDecimals(amountTokenInNative, decimals);

  console.log("tokenAmountToSwap: " + tokenAmountToSwap);

  let transaction = swapContract.methods.swapExactTokensForTokens(
    tokenAmountToSwap,
    0,
    [tokenAddress, constants.USDC_ADDRESS],
    account.address,
    Math.floor(Date.now() / 1000) + (60 * 5), // deadline
  );

  let estimatedGas = await transaction.estimateGas({from: account.address});

  const options = {
    to: transaction._parent._address,
    gas: estimatedGas,
    data: transaction.encodeABI(),
  };

  let signed = await web3.eth.accounts.signTransaction(options, privateKey);
  let receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

  return receipt;
}

async function sellTokenOnSushiSwap(privateKey, tokenAbi, tokenAddress, amountTokenInNative) {

  console.log('started selling token for USDC...')

  let receipt = await buyUSDCWithToken(privateKey, tokenAbi, tokenAddress, amountTokenInNative);

  return receipt;
}

function convertNativeAmountWithDecimals(amountInNative, decimals) {

  let multipliedAmount = web3.utils.toWei(`${amountInNative}`, 'ether');
  let powValue = new BN('10').pow(new BN(decimals));
  let weiValue = powValue.mul(new BN(multipliedAmount));
  let realResult = new BN(web3.utils.fromWei(`${weiValue}`));
  return realResult;
};

module.exports = { 
  run, 
  getPKlimaBalance, 
  getBCTBalance, 
  getVestingShare, 
  getReemable, 
  exercise, 
  buyUSDCWithToken,
  sellTokenOnSushiSwap,
  convertNativeAmountWithDecimals
};