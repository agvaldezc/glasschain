"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const transaction_1 = require("./transaction");
let transactionPool = [];
const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};
exports.getTransactionPool = getTransactionPool;
const addToTransactionPool = (tx, unspentTransactionOutputs) => {
    if (!transaction_1.validateTransaction(tx, unspentTransactionOutputs)) {
        throw Error('Trying to add invalid tx to pool');
    }
    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Trying to add invalid tx to pool');
    }
    console.log('adding to txPool: %s', JSON.stringify(tx));
    transactionPool.push(tx);
};
exports.addToTransactionPool = addToTransactionPool;
const hasTransactionInput = (transactionInput, unspentTransactionOutputs) => {
    const foundTransactionInput = unspentTransactionOutputs.find((uTxO) => {
        return uTxO.transactionOutputId === transactionInput.transactionOutputId && uTxO.transactionOutputIndex === transactionInput.transactionOutputIndex;
    });
    return foundTransactionInput !== undefined;
};
const updateTransactionPool = (unspentTransactionOutputs) => {
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
exports.updateTransactionPool = updateTransactionPool;
const getTxPoolIns = (aTransactionPool) => {
    return _(aTransactionPool)
        .map((tx) => tx.transactionInputs)
        .flatten()
        .value();
};
const isValidTxForPool = (tx, aTtransactionPool) => {
    const txPoolIns = getTxPoolIns(aTtransactionPool);
    const containsTransactionInput = (transactionInputs, transactionInput) => {
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
//# sourceMappingURL=transactionPool.js.map