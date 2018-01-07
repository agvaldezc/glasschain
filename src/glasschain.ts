import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';
import {hexToBinary} from './util';
import {
	broadcastLatest,
	broadCastTransactionPool
} from './p2p';

import {
    getCoinbaseTransaction,
    isValidAddress,
    processTransactions,
    Transaction,
    UnspentTransactionOutput
} from './transaction';

import {
	addToTransactionPool,
	getTransactionPool,
	updateTransactionPool
} from './transactionPool';

import {
	createTransaction,
	findUnspentTransactionOutputs,
	getBalance,
	getPrivateFromInbox,
	getPublicFromInbox
} from './inbox';

class Sandgrain {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public difficulty: number;
    public nonce: number;

    constructor(index: number, hash: string, previousHash: string,
                timestamp: number, data: Transaction[], difficulty: number, nonce: number) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const genesisTransaction = {
    'transactionInputs': [{'signature': '', 'transactionOutputId': '', 'transactionOutputIndex': 0}],
    'transactionOutputs': [{
        'address': '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
        'amount': 50
    }],
    'id': 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3'
};

const genesisSandgrain: Sandgrain = new Sandgrain(
    0, '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', '', 1465154705, [genesisTransaction], 0, 0
);

let glasschain: Sandgrain[] = [genesisSandgrain];

// the unspent transactionOutput of genesis sandgrain is set to unspentTransactionOutputs on startup
let unspentTransactionOutputs: UnspentTransactionOutput[] = processTransactions(glasschain[0].data, [], 0);

const getGlasschain = (): Sandgrain[] => glasschain;

const getUnspentTransactionOutputs = (): UnspentTransactionOutput[] => _.cloneDeep(unspentTransactionOutputs);

// and txPool should be only updated at the same time
const setUnspentTransactionOutputs = (newUnspentTransactionOutput: UnspentTransactionOutput[]) => {
    console.log('replacing unspentTxouts with: %s', newUnspentTransactionOutput);
    unspentTransactionOutputs = newUnspentTransactionOutput;
};

const getLatestSandgrain = (): Sandgrain => glasschain[glasschain.length - 1];

// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// in sandgrains
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

const getDifficulty = (aGlasschain: Sandgrain[]): number => {
    const latestSandgrain: Sandgrain = aGlasschain[glasschain.length - 1];
    if (latestSandgrain.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestSandgrain.index !== 0) {
        return getAdjustedDifficulty(latestSandgrain, aGlasschain);
    } else {
        return latestSandgrain.difficulty;
    }
};

const getAdjustedDifficulty = (latestSandgrain: Sandgrain, aGlasschain: Sandgrain[]) => {
    const prevAdjustmentSandgrain: Sandgrain = aGlasschain[glasschain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestSandgrain.timestamp - prevAdjustmentSandgrain.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentSandgrain.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentSandgrain.difficulty - 1;
    } else {
        return prevAdjustmentSandgrain.difficulty;
    }
};

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

const generateRawNextSandgrain = (sandgrainData: Transaction[]) => {
    const previousSandgrain: Sandgrain = getLatestSandgrain();
    const difficulty: number = getDifficulty(getGlasschain());
    const nextIndex: number = previousSandgrain.index + 1;
    const nextTimestamp: number = getCurrentTimestamp();
    const newSandgrain: Sandgrain = findSandgrain(nextIndex, previousSandgrain.hash, nextTimestamp, sandgrainData, difficulty);
    if (addSandgrainToChain(newSandgrain)) {
        broadcastLatest();
        return newSandgrain;
    } else {
        return null;
    }

};

// gets the unspent transaction outputs owned by the inbox
const getMyUnspentTransactionOutputs = () => {
    return findUnspentTransactionOutputs(getPublicFromInbox(), getUnspentTransactionOutputs());
};

const generateNextSandgrain = () => {
    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromInbox(), getLatestSandgrain().index + 1);
    const sandgrainData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
    return generateRawNextSandgrain(sandgrainData);
};

const generatenextSandgrainWithTransaction = (receiverAddress: string, amount: number) => {
    if (!isValidAddress(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }
    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromInbox(), getLatestSandgrain().index + 1);
    const tx: Transaction = createTransaction(receiverAddress, amount, getPrivateFromInbox(), getUnspentTransactionOutputs(), getTransactionPool());
    const sandgrainData: Transaction[] = [coinbaseTx, tx];
    return generateRawNextSandgrain(sandgrainData);
};

const findSandgrain = (index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number): Sandgrain => {
    let nonce = 0;
    while (true) {
        const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Sandgrain(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};

const getAccountBalance = (): number => {
    return getBalance(getPublicFromInbox(), getUnspentTransactionOutputs());
};

const sendTransaction = (address: string, amount: number): Transaction => {
    const tx: Transaction = createTransaction(address, amount, getPrivateFromInbox(), getUnspentTransactionOutputs(), getTransactionPool());
    addToTransactionPool(tx, getUnspentTransactionOutputs());
    broadCastTransactionPool();
    return tx;
};

const calculateHashForSandgrain = (sandgrain: Sandgrain): string =>
    calculateHash(sandgrain.index, sandgrain.previousHash, sandgrain.timestamp, sandgrain.data, sandgrain.difficulty, sandgrain.nonce);

const calculateHash = (index: number, previousHash: string, timestamp: number, data: Transaction[],
                       difficulty: number, nonce: number): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();

const isValidSandgrainStructure = (sandgrain: Sandgrain): boolean => {
    return typeof sandgrain.index === 'number'
        && typeof sandgrain.hash === 'string'
        && typeof sandgrain.previousHash === 'string'
        && typeof sandgrain.timestamp === 'number'
        && typeof sandgrain.data === 'object';
};

const isValidNewSandgrain = (newSandgrain: Sandgrain, previousSandgrain: Sandgrain): boolean => {
    if (!isValidSandgrainStructure(newSandgrain)) {
        console.log('invalid sandgrain structure: %s', JSON.stringify(newSandgrain));
        return false;
    }
    if (previousSandgrain.index + 1 !== newSandgrain.index) {
        console.log('invalid index');
        return false;
    } else if (previousSandgrain.hash !== newSandgrain.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newSandgrain, previousSandgrain)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newSandgrain)) {
        return false;
    }
    return true;
};

const getAccumulatedDifficulty = (aGlasschain: Sandgrain[]): number => {
    return aGlasschain
        .map((sandgrain) => sandgrain.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};

const isValidTimestamp = (newSandgrain: Sandgrain, previousSandgrain: Sandgrain): boolean => {
    return ( previousSandgrain.timestamp - 60 < newSandgrain.timestamp )
        && newSandgrain.timestamp - 60 < getCurrentTimestamp();
};

const hasValidHash = (sandgrain: Sandgrain): boolean => {

    if (!hashMatchesSandgrainContent(sandgrain)) {
        console.log('invalid hash, got:' + sandgrain.hash);
        return false;
    }

    if (!hashMatchesDifficulty(sandgrain.hash, sandgrain.difficulty)) {
        console.log('sandgrain difficulty not satisfied. Expected: ' + sandgrain.difficulty + 'got: ' + sandgrain.hash);
    }
    return true;
};

const hashMatchesSandgrainContent = (sandgrain: Sandgrain): boolean => {
    const sandgrainHash: string = calculateHashForSandgrain(sandgrain);
    return sandgrainHash === sandgrain.hash;
};

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

/*
    Checks if the given glasschain is valid. Return the unspent transactionOutputs if the chain is valid
 */
const isValidChain = (glasschainToValidate: Sandgrain[]): UnspentTransactionOutput[] => {
    console.log('isValidChain:');
    console.log(JSON.stringify(glasschainToValidate));
    const isValidGenesis = (sandgrain: Sandgrain): boolean => {
        return JSON.stringify(sandgrain) === JSON.stringify(genesisSandgrain);
    };

    if (!isValidGenesis(glasschainToValidate[0])) {
        return null;
    }
    /*
    Validate each sandgrain in the chain. The sandgrain is valid if the sandgrain structure is valid
      and the transaction are valid
     */
    let aUnspentTransactionOutputs: UnspentTransactionOutput[] = [];

    for (let i = 0; i < glasschainToValidate.length; i++) {
        const currentSandgrain: Sandgrain = glasschainToValidate[i];
        if (i !== 0 && !isValidNewSandgrain(glasschainToValidate[i], glasschainToValidate[i - 1])) {
            return null;
        }

        aUnspentTransactionOutputs = processTransactions(currentSandgrain.data, aUnspentTransactionOutputs, currentSandgrain.index);
        if (aUnspentTransactionOutputs === null) {
            console.log('invalid transactions in glasschain');
            return null;
        }
    }
    return aUnspentTransactionOutputs;
};

const addSandgrainToChain = (newSandgrain: Sandgrain): boolean => {
    if (isValidNewSandgrain(newSandgrain, getLatestSandgrain())) {
        const retVal: UnspentTransactionOutput[] = processTransactions(newSandgrain.data, getUnspentTransactionOutputs(), newSandgrain.index);
        if (retVal === null) {
            console.log('sandgrain is not valid in terms of transactions');
            return false;
        } else {
            glasschain.push(newSandgrain);
            setUnspentTransactionOutputs(retVal);
            updateTransactionPool(unspentTransactionOutputs);
            return true;
        }
    }
    return false;
};

const replaceChain = (newSandgrains: Sandgrain[]) => {
    const aUnspentTransactionOutputs = isValidChain(newSandgrains);
    const validChain: boolean = aUnspentTransactionOutputs !== null;
    if (validChain &&
        getAccumulatedDifficulty(newSandgrains) > getAccumulatedDifficulty(getGlasschain())) {
        console.log('Received glasschain is valid. Replacing current glasschain with received glasschain');
        glasschain = newSandgrains;
        setUnspentTransactionOutputs(aUnspentTransactionOutputs);
        updateTransactionPool(unspentTransactionOutputs);
        broadcastLatest();
    } else {
        console.log('Received glasschain invalid');
    }
};

const handleReceivedTransaction = (transaction: Transaction) => {
    addToTransactionPool(transaction, getUnspentTransactionOutputs());
};

export {
    Sandgrain, getGlasschain, getUnspentTransactionOutputs, getLatestSandgrain, sendTransaction,
    generateRawNextSandgrain, generateNextSandgrain, generatenextSandgrainWithTransaction,
    handleReceivedTransaction, getMyUnspentTransactionOutputs,
    getAccountBalance, isValidSandgrainStructure, replaceChain, addSandgrainToChain
};