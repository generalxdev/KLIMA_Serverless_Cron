var constants = require('../constants');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const Web3 = require('web3');
const privateKey = process.env.PRIVATE_KEY;
const swapPercent = parseFloat(process.env.SWAP_PERCENT);

const url_matic = 'https://rpc-mainnet.maticvigil.com';
const web3 = new Web3(url_matic);

const BN = web3.utils.BN;

const should = require('chai').should();
const expect = require('chai').expect;

const { 
  convertNativeAmountWithDecimals, 
  getPKlimaBalance,
  getBCTBalance,
  getReemable,
  getVestingShare,
} = require('../handler');
const { assert } = require('chai');

describe('convertNativeAmountWithDecimals', function() {

  it('0.1 with decimal 9 should give 100000000', function() {
    convertNativeAmountWithDecimals(0.1, 9).toString().should.equal(new BN(100000000).toString());
  });
});

describe('getPKlimaBalance', function() {

  this.timeout(5000);

  it('should give the the same value with returning of the pKLIMA balanceOf method', async function() {

    should.exist(privateKey);

    let address = web3.eth.accounts.privateKeyToAccount(privateKey).address;

    should.exist(address);

    let pKlimaBalance = await getPKlimaBalance(address);

    const token = new web3.eth.Contract(constants.PKLIMA_ABI, constants.PKLIMA_ADDRESS);

    let result = await token.methods.balanceOf(address).call();

    let nativeBalance = web3.utils.fromWei(result);

    expect(pKlimaBalance).to.equal(nativeBalance);
  });
});

describe('getBCTBalance', function() {

  this.timeout(5000);

  it('should give the the same value with returning of the BCT balanceOf method', async function() {

    should.exist(privateKey);

    let address = web3.eth.accounts.privateKeyToAccount(privateKey).address;

    should.exist(address);

    let bctBalance = await getBCTBalance(address);

    const token = new web3.eth.Contract(constants.BCT_ABI, constants.BCT_ADDRESS);

    let result = await token.methods.balanceOf(address).call();

    let nativeBalance = web3.utils.fromWei(result);

    expect(bctBalance).to.equal(nativeBalance);
  });
});

describe('getVestingShare', function() {

  this.timeout(5000);

  it('should give the same value with 1/10000 times of the returning percent of the PKLIMA Exercise terms method', async function() {

    should.exist(privateKey);

    let address = web3.eth.accounts.privateKeyToAccount(privateKey).address;

    should.exist(address);

    let vestingShare = await getVestingShare(address);

    const contract = new web3.eth.Contract(constants.EXERCISE_PKLIMA_ABI, constants.EXERCISE_PKLIMA_ADDRESS);

    let result = await contract.methods.terms(address).call();

    let returnPercent = result.percent / 10000;

    expect(vestingShare).to.equal(returnPercent);
  });
});

describe('getReemable', function() {

  this.timeout(5000);

  it('should give the same value with the returning of the PKLIMA Exercise redeemableFor method', async function() {

    should.exist(privateKey);

    let address = web3.eth.accounts.privateKeyToAccount(privateKey).address;

    should.exist(address);

    let redeemableAmount = await getReemable(address);

    const contract = new web3.eth.Contract(constants.EXERCISE_PKLIMA_ABI, constants.EXERCISE_PKLIMA_ADDRESS);

    let result = await contract.methods.redeemableFor(address).call();

    let nativeAmount = web3.utils.fromWei(result);

    expect(redeemableAmount).to.equal(nativeAmount);
  });
});