"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoJS = require("crypto-js");
const _ = require("lodash");
const util_1 = require("./util");
const p2p_1 = require("./p2p");
const transaction_1 = require("./transaction");
const transactionPool_1 = require("./transactionPool");
const inbox_1 = require("./inbox");
class Sandgrain {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}
exports.Sandgrain = Sandgrain;
const genesisTransaction = {
    'transactionInputs': [{ 'signature': '', 'transactionOutputId': '', 'transactionOutputIndex': 0 }],
    'transactionOutputs': [{
            'address': '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
            'amount': 50
        }],
    'id': 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3'
};
const genesisSandgrain = new Sandgrain(0, '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', '', 1465154705, [genesisTransaction], 0, 0);
let glasschain = [genesisSandgrain];
// the unspent transactionOutput of genesis sandgrain is set to unspentTransactionOutputs on startup
let unspentTransactionOutputs = transaction_1.processTransactions(glasschain[0].data, [], 0);
const getGlasschain = () => glasschain;
exports.getGlasschain = getGlasschain;
const getUnspentTransactionOutputs = () => _.cloneDeep(unspentTransactionOutputs);
exports.getUnspentTransactionOutputs = getUnspentTransactionOutputs;
// and txPool should be only updated at the same time
const setUnspentTransactionOutputs = (newUnspentTransactionOutput) => {
    console.log('replacing unspentTxouts with: %s', newUnspentTransactionOutput);
    unspentTransactionOutputs = newUnspentTransactionOutput;
};
const getLatestSandgrain = () => glasschain[glasschain.length - 1];
exports.getLatestSandgrain = getLatestSandgrain;
// in seconds
const BLOCK_GENERATION_INTERVAL = 10;
// in sandgrains
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;
const getDifficulty = (aGlasschain) => {
    const latestSandgrain = aGlasschain[glasschain.length - 1];
    if (latestSandgrain.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestSandgrain.index !== 0) {
        return getAdjustedDifficulty(latestSandgrain, aGlasschain);
    }
    else {
        return latestSandgrain.difficulty;
    }
};
const getAdjustedDifficulty = (latestSandgrain, aGlasschain) => {
    const prevAdjustmentSandgrain = aGlasschain[glasschain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken = latestSandgrain.timestamp - prevAdjustmentSandgrain.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentSandgrain.difficulty + 1;
    }
    else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentSandgrain.difficulty - 1;
    }
    else {
        return prevAdjustmentSandgrain.difficulty;
    }
};
const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);
const generateRawNextSandgrain = (sandgrainData) => {
    const previousSandgrain = getLatestSandgrain();
    const difficulty = getDifficulty(getGlasschain());
    const nextIndex = previousSandgrain.index + 1;
    const nextTimestamp = getCurrentTimestamp();
    const newSandgrain = findSandgrain(nextIndex, previousSandgrain.hash, nextTimestamp, sandgrainData, difficulty);
    if (addSandgrainToChain(newSandgrain)) {
        p2p_1.broadcastLatest();
        return newSandgrain;
    }
    else {
        return null;
    }
};
exports.generateRawNextSandgrain = generateRawNextSandgrain;
// gets the unspent transaction outputs owned by the inbox
const getMyUnspentTransactionOutputs = () => {
    return inbox_1.findUnspentTransactionOutputs(inbox_1.getPublicFromInbox(), getUnspentTransactionOutputs());
};
exports.getMyUnspentTransactionOutputs = getMyUnspentTransactionOutputs;
const generateNextSandgrain = () => {
    const coinbaseTx = transaction_1.getCoinbaseTransaction(inbox_1.getPublicFromInbox(), getLatestSandgrain().index + 1);
    const sandgrainData = [coinbaseTx].concat(transactionPool_1.getTransactionPool());
    return generateRawNextSandgrain(sandgrainData);
};
exports.generateNextSandgrain = generateNextSandgrain;
const generatenextSandgrainWithTransaction = (receiverAddress, amount) => {
    if (!transaction_1.isValidAddress(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }
    const coinbaseTx = transaction_1.getCoinbaseTransaction(inbox_1.getPublicFromInbox(), getLatestSandgrain().index + 1);
    const tx = inbox_1.createTransaction(receiverAddress, amount, inbox_1.getPrivateFromInbox(), getUnspentTransactionOutputs(), transactionPool_1.getTransactionPool());
    const sandgrainData = [coinbaseTx, tx];
    return generateRawNextSandgrain(sandgrainData);
};
exports.generatenextSandgrainWithTransaction = generatenextSandgrainWithTransaction;
const findSandgrain = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Sandgrain(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};
const getAccountBalance = () => {
    return inbox_1.getBalance(inbox_1.getPublicFromInbox(), getUnspentTransactionOutputs());
};
exports.getAccountBalance = getAccountBalance;
const sendTransaction = (address, amount) => {
    const tx = inbox_1.createTransaction(address, amount, inbox_1.getPrivateFromInbox(), getUnspentTransactionOutputs(), transactionPool_1.getTransactionPool());
    transactionPool_1.addToTransactionPool(tx, getUnspentTransactionOutputs());
    p2p_1.broadCastTransactionPool();
    return tx;
};
exports.sendTransaction = sendTransaction;
const calculateHashForSandgrain = (sandgrain) => calculateHash(sandgrain.index, sandgrain.previousHash, sandgrain.timestamp, sandgrain.data, sandgrain.difficulty, sandgrain.nonce);
const calculateHash = (index, previousHash, timestamp, data, difficulty, nonce) => CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
const isValidSandgrainStructure = (sandgrain) => {
    return typeof sandgrain.index === 'number'
        && typeof sandgrain.hash === 'string'
        && typeof sandgrain.previousHash === 'string'
        && typeof sandgrain.timestamp === 'number'
        && typeof sandgrain.data === 'object';
};
exports.isValidSandgrainStructure = isValidSandgrainStructure;
const isValidNewSandgrain = (newSandgrain, previousSandgrain) => {
    if (!isValidSandgrainStructure(newSandgrain)) {
        console.log('invalid sandgrain structure: %s', JSON.stringify(newSandgrain));
        return false;
    }
    if (previousSandgrain.index + 1 !== newSandgrain.index) {
        console.log('invalid index');
        return false;
    }
    else if (previousSandgrain.hash !== newSandgrain.previousHash) {
        console.log('invalid previoushash');
        return false;
    }
    else if (!isValidTimestamp(newSandgrain, previousSandgrain)) {
        console.log('invalid timestamp');
        return false;
    }
    else if (!hasValidHash(newSandgrain)) {
        return false;
    }
    return true;
};
const getAccumulatedDifficulty = (aGlasschain) => {
    return aGlasschain
        .map((sandgrain) => sandgrain.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};
const isValidTimestamp = (newSandgrain, previousSandgrain) => {
    return (previousSandgrain.timestamp - 60 < newSandgrain.timestamp)
        && newSandgrain.timestamp - 60 < getCurrentTimestamp();
};
const hasValidHash = (sandgrain) => {
    if (!hashMatchesSandgrainContent(sandgrain)) {
        console.log('invalid hash, got:' + sandgrain.hash);
        return false;
    }
    if (!hashMatchesDifficulty(sandgrain.hash, sandgrain.difficulty)) {
        console.log('sandgrain difficulty not satisfied. Expected: ' + sandgrain.difficulty + 'got: ' + sandgrain.hash);
    }
    return true;
};
const hashMatchesSandgrainContent = (sandgrain) => {
    const sandgrainHash = calculateHashForSandgrain(sandgrain);
    return sandgrainHash === sandgrain.hash;
};
const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = util_1.hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};
/*
    Checks if the given glasschain is valid. Return the unspent transactionOutputs if the chain is valid
 */
const isValidChain = (glasschainToValidate) => {
    console.log('isValidChain:');
    console.log(JSON.stringify(glasschainToValidate));
    const isValidGenesis = (sandgrain) => {
        return JSON.stringify(sandgrain) === JSON.stringify(genesisSandgrain);
    };
    if (!isValidGenesis(glasschainToValidate[0])) {
        return null;
    }
    /*
    Validate each sandgrain in the chain. The sandgrain is valid if the sandgrain structure is valid
      and the transaction are valid
     */
    let aUnspentTransactionOutputs = [];
    for (let i = 0; i < glasschainToValidate.length; i++) {
        const currentSandgrain = glasschainToValidate[i];
        if (i !== 0 && !isValidNewSandgrain(glasschainToValidate[i], glasschainToValidate[i - 1])) {
            return null;
        }
        aUnspentTransactionOutputs = transaction_1.processTransactions(currentSandgrain.data, aUnspentTransactionOutputs, currentSandgrain.index);
        if (aUnspentTransactionOutputs === null) {
            console.log('invalid transactions in glasschain');
            return null;
        }
    }
    return aUnspentTransactionOutputs;
};
const addSandgrainToChain = (newSandgrain) => {
    if (isValidNewSandgrain(newSandgrain, getLatestSandgrain())) {
        const retVal = transaction_1.processTransactions(newSandgrain.data, getUnspentTransactionOutputs(), newSandgrain.index);
        if (retVal === null) {
            console.log('sandgrain is not valid in terms of transactions');
            return false;
        }
        else {
            glasschain.push(newSandgrain);
            setUnspentTransactionOutputs(retVal);
            transactionPool_1.updateTransactionPool(unspentTransactionOutputs);
            return true;
        }
    }
    return false;
};
exports.addSandgrainToChain = addSandgrainToChain;
const replaceChain = (newSandgrains) => {
    const aUnspentTransactionOutputs = isValidChain(newSandgrains);
    const validChain = aUnspentTransactionOutputs !== null;
    if (validChain &&
        getAccumulatedDifficulty(newSandgrains) > getAccumulatedDifficulty(getGlasschain())) {
        console.log('Received glasschain is valid. Replacing current glasschain with received glasschain');
        glasschain = newSandgrains;
        setUnspentTransactionOutputs(aUnspentTransactionOutputs);
        transactionPool_1.updateTransactionPool(unspentTransactionOutputs);
        p2p_1.broadcastLatest();
    }
    else {
        console.log('Received glasschain invalid');
    }
};
exports.replaceChain = replaceChain;
const handleReceivedTransaction = (transaction) => {
    transactionPool_1.addToTransactionPool(transaction, getUnspentTransactionOutputs());
};
exports.handleReceivedTransaction = handleReceivedTransaction;
//# sourceMappingURL=glasschain.js.map