"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoJS = require("crypto-js");
/*import {broadcastLatest, broadCastTransactionPool} from './p2p';
import {
    getCoinbaseTransaction, isValidAddress, processTransactions, Transaction, UnspentTxOut
} from './transaction';
import {addToTransactionPool, getTransactionPool, updateTransactionPool} from './transactionPool';
import {hexToBinary} from './util';
import {createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet} from './wallet';
*/
class SandGrain {
    constructor(index, hash, previousHash, timestamp, data) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
    }
}
exports.SandGrain = SandGrain;
const calculateHash = (index, previousHash, timestamp, data) => CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
exports.calculateHash = calculateHash;
const calculateHashForSandGrain = (sandGrain) => calculateHash(sandGrain.index, sandGrain.previousHash, sandGrain.timestamp, sandGrain.data);
exports.calculateHashForSandGrain = calculateHashForSandGrain;
const genesisSandGrain = new SandGrain(0, 'bfc159e427ea8fa40f4942ca58798e70e0ed28a86282628eadaad17bd8e44d00', null, 0, 'Genesis SandGrain');
const generateNextSandGrain = (sandGrainData) => {
    const previousSandGrain = getLatestSandGrain();
    const nextIndex = previousSandGrain.index;
    const nextTimeStamp = new Date().getTime() / 1000;
    const nextHash = calculateHash(nextIndex, previousSandGrain.hash, nextTimeStamp, sandGrainData);
    const newSandGrain = new SandGrain(nextIndex, nextHash, previousSandGrain.hash, nextTimeStamp, sandGrainData);
    return newSandGrain;
};
exports.generateNextSandGrain = generateNextSandGrain;
const getLatestSandGrain = () => GlassChain[GlassChain.length - 1];
const GlassChain = [genesisSandGrain];
const getGlassChain = () => GlassChain;
exports.getGlassChain = getGlassChain;
const isValidNewSandGrain = (newSandGrain, previousSandGrain) => {
    if (previousSandGrain.index + 1 !== newSandGrain.index) {
        console.log('New SandGrain index is invalid.');
        return false;
    }
    else if (previousSandGrain.hash !== newSandGrain.previousHash) {
        console.log('New SandGrain previous hash is invalid.');
        return false;
    }
    else if (calculateHashForSandGrain(newSandGrain) !== newSandGrain.hash) {
        console.log('New SandGrain invalid hash: ' + calculateHashForSandGrain(newSandGrain) + ' should be: ' + newSandGrain.hash);
        return false;
    }
    return true;
};
exports.isValidNewSandGrain = isValidNewSandGrain;
const isValidSandGrainStructure = (sandGrain) => {
    return typeof sandGrain.index === 'number'
        && typeof sandGrain.hash === 'string'
        && typeof sandGrain.previousHash === 'string'
        && typeof sandGrain.timestamp === 'number'
        && typeof sandGrain.data === 'string';
};
exports.isValidSandGrainStructure = isValidSandGrainStructure;
const isValidChain = (glassChainToBeValidated) => {
    const isValidGenesis = (sandGrain) => {
        return JSON.stringify(sandGrain) === JSON.stringify(genesisSandGrain);
    };
    if (!isValidGenesis(glassChainToBeValidated[0])) {
        return false;
    }
    for (let i = 1; i < glassChainToBeValidated.length; i++) {
        if (!isValidNewSandGrain(glassChainToBeValidated[i], glassChainToBeValidated[i - 1])) {
            return false;
        }
    }
    return true;
};
exports.isValidChain = isValidChain;
const replaceChain = (newChain) => {
    if (isValidChain(newChain) && newChain.length > getGlassChain().length) {
        console.log('Received a new valid GlassChain. Replacing current GlassChain with new version.');
    }
    else {
        console.log('Received GlassChain is invalid. No changes were made to current GlassChain');
    }
};
exports.replaceChain = replaceChain;
//# sourceMappingURL=glasschain.js.map