"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elliptic_1 = require("elliptic");
const fs_1 = require("fs");
const _ = require("lodash");
const transaction_1 = require("./transaction");
const EC = new elliptic_1.ec('secp256k1');
const privateKeyLocation = process.env.PRIVATE_KEY || 'node/inbox/private_key';
const getPrivateFromInbox = () => {
    const buffer = fs_1.readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};
exports.getPrivateFromInbox = getPrivateFromInbox;
const getPublicFromInbox = () => {
    const privateKey = getPrivateFromInbox();
    const key = EC.keyFromPrivate(privateKey, 'hex');
    return key.getPublic().encode('hex');
};
exports.getPublicFromInbox = getPublicFromInbox;
const generatePrivateKey = () => {
    const keyPair = EC.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};
exports.generatePrivateKey = generatePrivateKey;
const initInbox = () => {
    // let's not override existing private keys
    if (fs_1.existsSync(privateKeyLocation)) {
        return;
    }
    const newPrivateKey = generatePrivateKey();
    fs_1.writeFileSync(privateKeyLocation, newPrivateKey);
    console.log('new inbox with private key created to : %s', privateKeyLocation);
};
exports.initInbox = initInbox;
const deleteInbox = () => {
    if (fs_1.existsSync(privateKeyLocation)) {
        fs_1.unlinkSync(privateKeyLocation);
    }
};
exports.deleteInbox = deleteInbox;
const getBalance = (address, unspentTransactionOutputs) => {
    return _(findUnspentTransactionOutputs(address, unspentTransactionOutputs))
        .map((uTxO) => uTxO.amount)
        .sum();
};
exports.getBalance = getBalance;
const findUnspentTransactionOutputs = (ownerAddress, unspentTransactionOutputs) => {
    return _.filter(unspentTransactionOutputs, (uTxO) => uTxO.address === ownerAddress);
};
exports.findUnspentTransactionOutputs = findUnspentTransactionOutputs;
const findTransactionOutputsForAmount = (amount, myUnspentTransactionOutputs) => {
    let currentAmount = 0;
    const includedUnspentTransactionOutputs = [];
    for (const myUnspentTransactionOutput of myUnspentTransactionOutputs) {
        includedUnspentTransactionOutputs.push(myUnspentTransactionOutput);
        currentAmount = currentAmount + myUnspentTransactionOutput.amount;
        if (currentAmount >= amount) {
            const leftOverAmount = currentAmount - amount;
            return { includedUnspentTransactionOutputs, leftOverAmount };
        }
    }
    const eMsg = 'Cannot create transaction from the available unspent transaction outputs.' +
        ' Required amount:' + amount + '. Available unspentTransactionOutputs:' + JSON.stringify(myUnspentTransactionOutputs);
    throw Error(eMsg);
};
const createTransactionOutputs = (receiverAddress, myAddress, amount, leftOverAmount) => {
    const transactionOutput1 = new transaction_1.TransactionOutput(receiverAddress, amount);
    if (leftOverAmount === 0) {
        return [transactionOutput1];
    }
    else {
        const leftOverTx = new transaction_1.TransactionOutput(myAddress, leftOverAmount);
        return [transactionOutput1, leftOverTx];
    }
};
const filterTransactionPoolTransactions = (unspentTransactionOutputs, transactionPool) => {
    const transactionInputs = _(transactionPool)
        .map((tx) => tx.transactionInputs)
        .flatten()
        .value();
    const removable = [];
    for (const unspentTransactionOutput of unspentTransactionOutputs) {
        const transactionInput = _.find(transactionInputs, (aTransactionInput) => {
            return aTransactionInput.transactionOutputIndex === unspentTransactionOutput.transactionOutputIndex && aTransactionInput.transactionOutputId === unspentTransactionOutput.transactionOutputId;
        });
        if (transactionInput === undefined) {
        }
        else {
            removable.push(unspentTransactionOutput);
        }
    }
    return _.without(unspentTransactionOutputs, ...removable);
};
const createTransaction = (receiverAddress, amount, privateKey, unspentTransactionOutputs, transactionPool) => {
    console.log('transactionPool: %s', JSON.stringify(transactionPool));
    const myAddress = transaction_1.getPublicKey(privateKey);
    const myUnspentTransactionOutputsA = unspentTransactionOutputs.filter((uTxO) => uTxO.address === myAddress);
    const myUnspentTransactionOutputs = filterTransactionPoolTransactions(myUnspentTransactionOutputsA, transactionPool);
    // filter from unspentOutputs such inputs that are referenced in pool
    const { includedUnspentTransactionOutputs, leftOverAmount } = findTransactionOutputsForAmount(amount, myUnspentTransactionOutputs);
    const toUnsignedTransactionInput = (unspentTransactionOutput) => {
        const transactionInput = new transaction_1.TransactionInput();
        transactionInput.transactionOutputId = unspentTransactionOutput.transactionOutputId;
        transactionInput.transactionOutputIndex = unspentTransactionOutput.transactionOutputIndex;
        return transactionInput;
    };
    const unsignedTransactionInputs = includedUnspentTransactionOutputs.map(toUnsignedTransactionInput);
    const tx = new transaction_1.Transaction();
    tx.transactionInputs = unsignedTransactionInputs;
    tx.transactionOutputs = createTransactionOutputs(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = transaction_1.getTransactionId(tx);
    tx.transactionInputs = tx.transactionInputs.map((transactionInput, index) => {
        transactionInput.signature = transaction_1.signTransactionInput(tx, index, privateKey, unspentTransactionOutputs);
        return transactionInput;
    });
    return tx;
};
exports.createTransaction = createTransaction;
//# sourceMappingURL=inbox.js.map