import * as _ from 'lodash';
import {Transaction, TransactionInput, UnspentTransactionOutput, validateTransaction} from './transaction';

let transactionPool: Transaction[] = [];

const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};

const addToTransactionPool = (tx: Transaction, unspentTransactionOutputs: UnspentTransactionOutput[]) => {

    if (!validateTransaction(tx, unspentTransactionOutputs)) {
        throw Error('Trying to add invalid tx to pool');
    }

    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Trying to add invalid tx to pool');
    }
    console.log('adding to txPool: %s', JSON.stringify(tx));
    transactionPool.push(tx);
};

const hasTransactionInput = (transactionInput: TransactionInput, unspentTransactionOutputs: UnspentTransactionOutput[]): boolean => {
    const foundTransactionInput = unspentTransactionOutputs.find((uTxO: UnspentTransactionOutput) => {
        return uTxO.transactionOutputId === transactionInput.transactionOutputId && uTxO.transactionOutputIndex === transactionInput.transactionOutputIndex;
    });
    return foundTransactionInput !== undefined;
};

const updateTransactionPool = (unspentTransactionOutputs: UnspentTransactionOutput[]) => {
    const invalidTxs = [];
    for (const tx of transactionPool) {
        for (const transactionInput of tx.transactionInputs) {
            if (!hasTransactionInput(transactionInput, unspentTransactionOutputs)) {
                invalidTxs.push(tx);
                break;
            }
        }
    }
    if (invalidTxs.length > 0) {
        console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
        transactionPool = _.without(transactionPool, ...invalidTxs);
    }
};

const getTxPoolIns = (aTransactionPool: Transaction[]): TransactionInput[] => {
    return _(aTransactionPool)
        .map((tx) => tx.transactionInputs)
        .flatten()
        .value();
};

const isValidTxForPool = (tx: Transaction, aTtransactionPool: Transaction[]): boolean => {
    const txPoolIns: TransactionInput[] = getTxPoolIns(aTtransactionPool);

    const containsTransactionInput = (transactionInputs: TransactionInput[], transactionInput: TransactionInput) => {
        return _.find(txPoolIns, ((txPoolIn) => {
            return transactionInput.transactionOutputIndex === txPoolIn.transactionOutputIndex && transactionInput.transactionOutputId === txPoolIn.transactionOutputId;
        }));
    };

    for (const transactionInput of tx.transactionInputs) {
        if (containsTransactionInput(txPoolIns, transactionInput)) {
            console.log('transactionInput already found in the txPool');
            return false;
        }
    }
    return true;
};

export {addToTransactionPool, getTransactionPool, updateTransactionPool};