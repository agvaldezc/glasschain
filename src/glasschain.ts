import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';

/*import {broadcastLatest, broadCastTransactionPool} from './p2p';
import {
    getCoinbaseTransaction, isValidAddress, processTransactions, Transaction, UnspentTxOut
} from './transaction';
import {addToTransactionPool, getTransactionPool, updateTransactionPool} from './transactionPool';
import {hexToBinary} from './util';
import {createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet} from './wallet';
*/

class SandGrain {
    public index: number;
	public hash: string;
	public previousHash: string;
	public timestamp: number;
	public data: string;

	constructor(index: number, hash: string, previousHash: string, timestamp: number, data: string) {
		this.index = index;
		this.hash = hash;
		this.previousHash = previousHash;
		this.timestamp = timestamp;
		this.data = data;
	}
}

const calculateHash = (index: number, previousHash: string, timestamp: number, data: string): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data).toString();

const calculateHashForSandGrain = (sandGrain: SandGrain): string =>
	calculateHash(sandGrain.index, sandGrain.previousHash, sandGrain.timestamp, sandGrain.data);

const genesisSandGrain: SandGrain = new SandGrain(
	0, 'bfc159e427ea8fa40f4942ca58798e70e0ed28a86282628eadaad17bd8e44d00', null, 0, 'Genesis SandGrain'
);

const generateNextSandGrain = (sandGrainData: string): SandGrain => {
	const previousSandGrain: SandGrain = getLatestSandGrain();
	const nextIndex: number = previousSandGrain.index;
	const nextTimeStamp: number = new Date().getTime() / 1000;
	const nextHash: string = calculateHash(
		nextIndex, previousSandGrain.hash, nextTimeStamp, sandGrainData
	);
	const newSandGrain: SandGrain = new SandGrain(
		nextIndex, nextHash, previousSandGrain.hash, nextTimeStamp, sandGrainData
	);
	return newSandGrain;
};

const getLatestSandGrain = (): SandGrain => GlassChain[GlassChain.length - 1];

const GlassChain: SandGrain[] = [genesisSandGrain];

const getGlassChain = (): SandGrain[] => GlassChain;

const isValidNewSandGrain = (newSandGrain: SandGrain, previousSandGrain: SandGrain): boolean => {
	if (previousSandGrain.index + 1 !== newSandGrain.index) {
		console.log('New SandGrain index is invalid.');
		return false;
	} else if (previousSandGrain.hash !== newSandGrain.previousHash) {
		console.log('New SandGrain previous hash is invalid.');
		return false;
	} else if (calculateHashForSandGrain(newSandGrain) !== newSandGrain.hash) {
		console.log('New SandGrain invalid hash: ' + calculateHashForSandGrain(newSandGrain) + ' should be: ' + newSandGrain.hash);
		return false;
	}

	return true;
};

const isValidSandGrainStructure = (sandGrain: SandGrain): boolean => {
	return typeof sandGrain.index === 'number'
		&& typeof sandGrain.hash === 'string'
		&& typeof sandGrain.previousHash === 'string'
		&& typeof sandGrain.timestamp === 'number'
		&& typeof sandGrain.data === 'string';
};

const isValidChain = (glassChainToBeValidated: SandGrain[]): boolean => {
	const isValidGenesis = (sandGrain: SandGrain): boolean => {
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

const replaceChain = (newChain: SandGrain[]) => {
	if (isValidChain(newChain) && newChain.length > getGlassChain().length) {
		console.log('Received a new valid GlassChain. Replacing current GlassChain with new version.');
	} else {
		console.log('Received GlassChain is invalid. No changes were made to current GlassChain');
	}
};

export {
	SandGrain, calculateHash, calculateHashForSandGrain, generateNextSandGrain,
	getGlassChain, isValidNewSandGrain, isValidSandGrainStructure, isValidChain,
	replaceChain
};
