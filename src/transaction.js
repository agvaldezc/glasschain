"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoJS = require("crypto-js");
const ecdsa = require("elliptic");
const _ = require("lodash");
const ec = new ecdsa.ec('secp256k1');
const COINBASE_AMOUNT = 50;
class UnspentTransactionOutput {
    constructor(transactionOutputId, transactionOutputIndex, address, amount) {
        this.transactionOutputId = transactionOutputId;
        this.transactionOutputIndex = transactionOutputIndex;
        this.address = address;
        this.amount = amount;
    }
}
exports.UnspentTransactionOutput = UnspentTransactionOutput;
class TransactionInput {
}
exports.TransactionInput = TransactionInput;
class TransactionOutput {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}
exports.TransactionOutput = TransactionOutput;
class Transaction {
}
exports.Transaction = Transaction;
const getTransactionId = (transaction) => {
    const transactionInputContent = transaction.transactionInputs
        .map((transactionInput) => transactionInput.transactionOutputId + transactionInput.transactionOutputIndex)
        .reduce((a, b) => a + b, '');
    const transactionOutputContent = transaction.transactionOutputs
        .map((transactionOutput) => transactionOutput.address + transactionOutput.amount)
        .reduce((a, b) => a + b, '');
    return CryptoJS.SHA256(transactionInputContent + transactionOutputContent).toString();
};
exports.getTransactionId = getTransactionId;
const validateTransaction = (transaction, unspentTransactionOutputs) => {
    if (!isValidTransactionStructure(transaction)) {
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid tx id: ' + transaction.id);
        return false;
    }
    const hasValidTransactionInputs = transaction.transactionInputs
        .map((transactionInput) => validateTransactionInput(transactionInput, transaction, unspentTransactionOutputs))
        .reduce((a, b) => a && b, true);
    if (!hasValidTransactionInputs) {
        console.log('some of the transactionInputs are invalid in tx: ' + transaction.id);
        return false;
    }
    const totalTransactionInputValues = transaction.transactionInputs
        .map((transactionInput) => getTransactionInputAmount(transactionInput, unspentTransactionOutputs))
        .reduce((a, b) => (a + b), 0);
    const totalTransactionOutputValues = transaction.transactionOutputs
        .map((transactionOutput) => transactionOutput.amount)
        .reduce((a, b) => (a + b), 0);
    if (totalTransactionOutputValues !== totalTransactionInputValues) {
        console.log('totalTransactionOutputValues !== totalTransactionInputValues in tx: ' + transaction.id);
        return false;
    }
    return true;
};
exports.validateTransaction = validateTransaction;
const validateBlockTransactions = (transactions, unspentTransactionOutputs, blockIndex) => {
    const coinbaseTx = transactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
        return false;
    }
    // check for duplicate transactionInputs. Each transactionInput can be included only once
    const transactionInputs = _(transactions)
        .map((tx) => tx.transactionInputs)
        .flatten()
        .value();
    if (hasDuplicates(transactionInputs)) {
        return false;
    }
    // all but coinbase transactions
    const normalTransactions = transactions.slice(1);
    return normalTransactions.map((tx) => validateTransaction(tx, unspentTransactionOutputs))
        .reduce((a, b) => (a && b), true);
};
const hasDuplicates = (transactionInputs) => {
    const groups = _.countBy(transactionInputs, (transactionInput) => transactionInput.transactionOutputId + transactionInput.transactionOutputIndex);
    return _(groups)
        .map((value, key) => {
        if (value > 1) {
            console.log('duplicate transactionInput: ' + key);
            return true;
        }
        else {
            return false;
        }
    })
        .includes(true);
};
exports.hasDuplicates = hasDuplicates;
const validateCoinbaseTx = (transaction, blockIndex) => {
    if (transaction == null) {
        console.log('the first transaction in the block must be coinbase transaction');
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid coinbase tx id: ' + transaction.id);
        return false;
    }
    if (transaction.transactionInputs.length !== 1) {
        console.log('one transactionInput must be specified in the coinbase transaction');
        return;
    }
    if (transaction.transactionInputs[0].transactionOutputIndex !== blockIndex) {
        console.log('the transactionInput signature in coinbase tx must be the block height');
        return false;
    }
    if (transaction.transactionOutputs.length !== 1) {
        console.log('invalid number of transactionOutputs in coinbase transaction');
        return false;
    }
    if (transaction.transactionOutputs[0].amount !== COINBASE_AMOUNT) {
        console.log('invalid coinbase amount in coinbase transaction');
        return false;
    }
    return true;
};
const validateTransactionInput = (transactionInput, transaction, unspentTransactionOutputs) => {
    const referencedUTransactionOutput = unspentTransactionOutputs.find((uTxO) => uTxO.transactionOutputId === transactionInput.transactionOutputId && uTxO.transactionOutputIndex === transactionInput.transactionOutputIndex);
    if (referencedUTransactionOutput == null) {
        console.log('referenced transactionOutput not found: ' + JSON.stringify(transactionInput));
        return false;
    }
    const address = referencedUTransactionOutput.address;
    const key = ec.keyFromPublic(address, 'hex');
    const validSignature = key.verify(transaction.id, transactionInput.signature);
    if (!validSignature) {
        console.log('invalid transactionInput signature: %s txId: %s address: %s', transactionInput.signature, transaction.id, referencedUTransactionOutput.address);
        return false;
    }
    return true;
};
const getTransactionInputAmount = (transactionInput, unspentTransactionOutputs) => {
    return findUnspentTransactionOutput(transactionInput.transactionOutputId, transactionInput.transactionOutputIndex, unspentTransactionOutputs).amount;
};
const findUnspentTransactionOutput = (transactionId, index, unspentTransactionOutputs) => {
    return unspentTransactionOutputs.find((uTxO) => uTxO.transactionOutputId === transactionId && uTxO.transactionOutputIndex === index);
};
const getCoinbaseTransaction = (address, blockIndex) => {
    const t = new Transaction();
    const transactionInput = new TransactionInput();
    transactionInput.signature = '';
    transactionInput.transactionOutputId = '';
    transactionInput.transactionOutputIndex = blockIndex;
    t.transactionInputs = [transactionInput];
    t.transactionOutputs = [new TransactionOutput(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
};
exports.getCoinbaseTransaction = getCoinbaseTransaction;
const signTransactionInput = (transaction, transactionInputIndex, privateKey, unspentTransactionOutputs) => {
    const transactionInput = transaction.transactionInputs[transactionInputIndex];
    const dataToSign = transaction.id;
    const referencedUnspentTransactionOutput = findUnspentTransactionOutput(transactionInput.transactionOutputId, transactionInput.transactionOutputIndex, unspentTransactionOutputs);
    if (referencedUnspentTransactionOutput == null) {
        console.log('could not find referenced transactionOutput');
        throw Error();
    }
    const referencedAddress = referencedUnspentTransactionOutput.address;
    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log('trying to sign an input with private' +
            ' key that does not match the address that is referenced in transactionInput');
        throw Error();
    }
    const key = ec.keyFromPrivate(privateKey, 'hex');
    const signature = toHexString(key.sign(dataToSign).toDER());
    return signature;
};
exports.signTransactionInput = signTransactionInput;
const updateUnspentTransactionOutputs = (transactions, unspentTransactionOutputs) => {
    const newUnspentTransactionOutputs = transactions
        .map((t) => {
        return t.transactionOutputs.map((transactionOutput, index) => new UnspentTransactionOutput(t.id, index, transactionOutput.address, transactionOutput.amount));
    })
        .reduce((a, b) => a.concat(b), []);
    const consumedTransactionOutputs = transactions
        .map((t) => t.transactionInputs)
        .reduce((a, b) => a.concat(b), [])
        .map((transactionInput) => new UnspentTransactionOutput(transactionInput.transactionOutputId, transactionInput.transactionOutputIndex, '', 0));
    const resultingUnspentTransactionOutputs = unspentTransactionOutputs
        .filter(((uTxO) => !findUnspentTransactionOutput(uTxO.transactionOutputId, uTxO.transactionOutputIndex, consumedTransactionOutputs)))
        .concat(newUnspentTransactionOutputs);
    return resultingUnspentTransactionOutputs;
};
const processTransactions = (transactions, unspentTransactionOutputs, blockIndex) => {
    if (!validateBlockTransactions(transactions, unspentTransactionOutputs, blockIndex)) {
        console.log('invalid block transactions');
        return null;
    }
    return updateUnspentTransactionOutputs(transactions, unspentTransactionOutputs);
};
exports.processTransactions = processTransactions;
const toHexString = (byteArray) => {
    return Array.from(byteArray, (byte) => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
};
const getPublicKey = (privateKey) => {
    return ec.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex');
};
exports.getPublicKey = getPublicKey;
const isValidTransactionInputStructure = (transactionInput) => {
    if (transactionInput == null) {
        console.log('transactionInput is null');
        return false;
    }
    else if (typeof transactionInput.signature !== 'string') {
        console.log('invalid signature type in transactionInput');
        return false;
    }
    else if (typeof transactionInput.transactionOutputId !== 'string') {
        console.log('invalid transactionOutputId type in transactionInput');
        return false;
    }
    else if (typeof transactionInput.transactionOutputIndex !== 'number') {
        console.log('invalid transactionOutputIndex type in transactionInput');
        return false;
    }
    else {
        return true;
    }
};
const isValidTransactionOutputStructure = (transactionOutput) => {
    if (transactionOutput == null) {
        console.log('transactionOutput is null');
        return false;
    }
    else if (typeof transactionOutput.address !== 'string') {
        console.log('invalid address type in transactionOutput');
        return false;
    }
    else if (!isValidAddress(transactionOutput.address)) {
        console.log('invalid TransactionOutput address');
        return false;
    }
    else if (typeof transactionOutput.amount !== 'number') {
        console.log('invalid amount type in transactionOutput');
        return false;
    }
    else {
        return true;
    }
};
const isValidTransactionStructure = (transaction) => {
    if (typeof transaction.id !== 'string') {
        console.log('transactionId missing');
        return false;
    }
    if (!(transaction.transactionInputs instanceof Array)) {
        console.log('invalid transactionInputs type in transaction');
        return false;
    }
    if (!transaction.transactionInputs
        .map(isValidTransactionInputStructure)
        .reduce((a, b) => (a && b), true)) {
        return false;
    }
    if (!(transaction.transactionOutputs instanceof Array)) {
        console.log('invalid transactionInputs type in transaction');
        return false;
    }
    if (!transaction.transactionOutputs
        .map(isValidTransactionOutputStructure)
        .reduce((a, b) => (a && b), true)) {
        return false;
    }
    return true;
};
// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address) => {
    if (address.length !== 130) {
        console.log(address);
        console.log('invalid public key length');
        return false;
    }
    else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    }
    else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};
exports.isValidAddress = isValidAddress;
//# sourceMappingURL=transaction.js.map