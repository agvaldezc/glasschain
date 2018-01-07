import {ec} from 'elliptic';

import {
    existsSync,
    readFileSync,
    unlinkSync,
    writeFileSync
} from 'fs';

import * as _ from 'lodash';

import {
    getPublicKey,
    getTransactionId,
    signTransactionInput,
    Transaction,
    TransactionInput,
    TransactionOutput,
    UnspentTransactionOutput
} from './transaction';

const EC = new ec('secp256k1');

const privateKeyLocation = process.env.PRIVATE_KEY || 'node/inbox/private_key';

const getPrivateFromInbox = (): string => {
    const buffer = readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};

const getPublicFromInbox = (): string => {
    const privateKey = getPrivateFromInbox();
    const key = EC.keyFromPrivate(privateKey, 'hex');
    return key.getPublic().encode('hex');
};

const generatePrivateKey = (): string => {
    const keyPair = EC.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};

const initInbox = () => {
    // let's not override existing private keys
    if (existsSync(privateKeyLocation)) {
        return;
    }
    const newPrivateKey = generatePrivateKey();

    writeFileSync(privateKeyLocation, newPrivateKey);
    console.log('new inbox with private key created to : %s', privateKeyLocation);
};

const deleteInbox = () => {
    if (existsSync(privateKeyLocation)) {
        unlinkSync(privateKeyLocation);
    }
};

const getBalance = (address: string, unspentTransactionOutputs: UnspentTransactionOutput[]): number => {
    return _(findUnspentTransactionOutputs(address, unspentTransactionOutputs))
        .map((uTxO: UnspentTransactionOutput) => uTxO.amount)
        .sum();
};

const findUnspentTransactionOutputs = (ownerAddress: string, unspentTransactionOutputs: UnspentTransactionOutput[]) => {
    return _.filter(unspentTransactionOutputs, (uTxO: UnspentTransactionOutput) => uTxO.address === ownerAddress);
};

const findTransactionOutputsForAmount = (amount: number, myUnspentTransactionOutputs: UnspentTransactionOutput[]) => {
    let currentAmount = 0;
    const includedUnspentTransactionOutputs = [];
    for (const myUnspentTransactionOutput of myUnspentTransactionOutputs) {
        includedUnspentTransactionOutputs.push(myUnspentTransactionOutput);
        currentAmount = currentAmount + myUnspentTransactionOutput.amount;
        if (currentAmount >= amount) {
            const leftOverAmount = currentAmount - amount;
            return {includedUnspentTransactionOutputs, leftOverAmount};
        }
    }

    const eMsg = 'Cannot create transaction from the available unspent transaction outputs.' +
        ' Required amount:' + amount + '. Available unspentTransactionOutputs:' + JSON.stringify(myUnspentTransactionOutputs);
    throw Error(eMsg);
};

const createTransactionOutputs = (receiverAddress: string, myAddress: string, amount, leftOverAmount: number) => {
    const transactionOutput1: TransactionOutput = new TransactionOutput(receiverAddress, amount);
    if (leftOverAmount === 0) {
        return [transactionOutput1];
    } else {
        const leftOverTx = new TransactionOutput(myAddress, leftOverAmount);
        return [transactionOutput1, leftOverTx];
    }
};

const filterTransactionPoolTransactions = (unspentTransactionOutputs: UnspentTransactionOutput[], transactionPool: Transaction[]): UnspentTransactionOutput[] => {
    const transactionInputs: TransactionInput[] = _(transactionPool)
        .map((tx: Transaction) => tx.transactionInputs)
        .flatten()
        .value();
    const removable: UnspentTransactionOutput[] = [];
    for (const unspentTransactionOutput of unspentTransactionOutputs) {
        const transactionInput = _.find(transactionInputs, (aTransactionInput: TransactionInput) => {
            return aTransactionInput.transactionOutputIndex === unspentTransactionOutput.transactionOutputIndex && aTransactionInput.transactionOutputId === unspentTransactionOutput.transactionOutputId;
        });

        if (transactionInput === undefined) {

        } else {
            removable.push(unspentTransactionOutput);
        }
    }

    return _.without(unspentTransactionOutputs, ...removable);
};

const createTransaction = (receiverAddress: string, amount: number, privateKey: string,
                           unspentTransactionOutputs: UnspentTransactionOutput[], transactionPool: Transaction[]): Transaction => {

    console.log('transactionPool: %s', JSON.stringify(transactionPool));
    const myAddress: string = getPublicKey(privateKey);
    const myUnspentTransactionOutputsA = unspentTransactionOutputs.filter((uTxO: UnspentTransactionOutput) => uTxO.address === myAddress);

    const myUnspentTransactionOutputs = filterTransactionPoolTransactions(myUnspentTransactionOutputsA, transactionPool);

    // filter from unspentOutputs such inputs that are referenced in pool
    const {includedUnspentTransactionOutputs, leftOverAmount} = findTransactionOutputsForAmount(amount, myUnspentTransactionOutputs);

    const toUnsignedTransactionInput = (unspentTransactionOutput: UnspentTransactionOutput) => {
        const transactionInput: TransactionInput = new TransactionInput();
        transactionInput.transactionOutputId = unspentTransactionOutput.transactionOutputId;
        transactionInput.transactionOutputIndex = unspentTransactionOutput.transactionOutputIndex;
        return transactionInput;
    };

    const unsignedTransactionInputs: TransactionInput[] = includedUnspentTransactionOutputs.map(toUnsignedTransactionInput);

    const tx: Transaction = new Transaction();
    tx.transactionInputs = unsignedTransactionInputs;
    tx.transactionOutputs = createTransactionOutputs(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = getTransactionId(tx);

    tx.transactionInputs = tx.transactionInputs.map((transactionInput: TransactionInput, index: number) => {
        transactionInput.signature = signTransactionInput(tx, index, privateKey, unspentTransactionOutputs);
        return transactionInput;
    });

    return tx;
};

export {
    createTransaction,
    getPublicFromInbox,
    getPrivateFromInbox,
    getBalance,
    generatePrivateKey,
    initInbox,
    deleteInbox,
    findUnspentTransactionOutputs
};