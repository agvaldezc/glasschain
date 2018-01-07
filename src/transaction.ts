import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as _ from 'lodash'

const ec = new ecdsa.ec('secp256k1');

const COINBASE_AMOUNT: number = 50;

class UnspentTransactionOutput {
    public readonly transactionOutputId: string;
    public readonly transactionOutputIndex: number;
    public readonly address: string;
    public readonly amount: number;

    constructor(transactionOutputId: string, transactionOutputIndex: number, address: string, amount: number) {
        this.transactionOutputId = transactionOutputId;
        this.transactionOutputIndex = transactionOutputIndex;
        this.address = address;
        this.amount = amount;
    }
}

class TransactionInput {
    public transactionOutputId: string;
    public transactionOutputIndex: number;
    public signature: string;
}

class TransactionOutput {
    public address: string;
    public amount: number;

    constructor(address: string, amount: number) {
        this.address = address;
        this.amount = amount;
    }
}

class Transaction {

    public id: string;

    public transactionInputs: TransactionInput[];
    public transactionOutputs: TransactionOutput[];
}

const getTransactionId = (transaction: Transaction): string => {
    const transactionInputContent: string = transaction.transactionInputs
        .map((transactionInput: TransactionInput) => transactionInput.transactionOutputId + transactionInput.transactionOutputIndex)
        .reduce((a, b) => a + b, '');

    const transactionOutputContent: string = transaction.transactionOutputs
        .map((transactionOutput: TransactionOutput) => transactionOutput.address + transactionOutput.amount)
        .reduce((a, b) => a + b, '');

    return CryptoJS.SHA256(transactionInputContent + transactionOutputContent).toString();
};

const validateTransaction = (transaction: Transaction, unspentTransactionOutputs: UnspentTransactionOutput[]): boolean => {

    if (!isValidTransactionStructure(transaction)) {
        return false;
    }

    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid tx id: ' + transaction.id);
        return false;
    }
    const hasValidTransactionInputs: boolean = transaction.transactionInputs
        .map((transactionInput) => validateTransactionInput(transactionInput, transaction, unspentTransactionOutputs))
        .reduce((a, b) => a && b, true);

    if (!hasValidTransactionInputs) {
        console.log('some of the transactionInputs are invalid in tx: ' + transaction.id);
        return false;
    }

    const totalTransactionInputValues: number = transaction.transactionInputs
        .map((transactionInput) => getTransactionInputAmount(transactionInput, unspentTransactionOutputs))
        .reduce((a, b) => (a + b), 0);

    const totalTransactionOutputValues: number = transaction.transactionOutputs
        .map((transactionOutput) => transactionOutput.amount)
        .reduce((a, b) => (a + b), 0);

    if (totalTransactionOutputValues !== totalTransactionInputValues) {
        console.log('totalTransactionOutputValues !== totalTransactionInputValues in tx: ' + transaction.id);
        return false;
    }

    return true;
};

const validateBlockTransactions = (transactions: Transaction[], unspentTransactionOutputs: UnspentTransactionOutput[], blockIndex: number): boolean => {
    const coinbaseTx = transactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
        return false;
    }

    // check for duplicate transactionInputs. Each transactionInput can be included only once
    const transactionInputs: TransactionInput[] = _(transactions)
        .map((tx) => tx.transactionInputs)
        .flatten()
        .value();

    if (hasDuplicates(transactionInputs)) {
        return false;
    }

    // all but coinbase transactions
    const normalTransactions: Transaction[] = transactions.slice(1);
    return normalTransactions.map((tx) => validateTransaction(tx, unspentTransactionOutputs))
        .reduce((a, b) => (a && b), true);

};

const hasDuplicates = (transactionInputs: TransactionInput[]): boolean => {
    const groups = _.countBy(transactionInputs, (transactionInput: TransactionInput) => transactionInput.transactionOutputId + transactionInput.transactionOutputIndex);
    return _(groups)
        .map((value, key) => {
            if (value > 1) {
                console.log('duplicate transactionInput: ' + key);
                return true;
            } else {
                return false;
            }
        })
        .includes(true);
};

const validateCoinbaseTx = (transaction: Transaction, blockIndex: number): boolean => {
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

const validateTransactionInput = (transactionInput: TransactionInput, transaction: Transaction, unspentTransactionOutputs: UnspentTransactionOutput[]): boolean => {
    const referencedUTransactionOutput: UnspentTransactionOutput =
        unspentTransactionOutputs.find((uTxO) => uTxO.transactionOutputId === transactionInput.transactionOutputId && uTxO.transactionOutputIndex === transactionInput.transactionOutputIndex);
    if (referencedUTransactionOutput == null) {
        console.log('referenced transactionOutput not found: ' + JSON.stringify(transactionInput));
        return false;
    }
    const address = referencedUTransactionOutput.address;

    const key = ec.keyFromPublic(address, 'hex');
    const validSignature: boolean = key.verify(transaction.id, transactionInput.signature);
    if (!validSignature) {
        console.log('invalid transactionInput signature: %s txId: %s address: %s', transactionInput.signature, transaction.id, referencedUTransactionOutput.address);
        return false;
    }
    return true;
};

const getTransactionInputAmount = (transactionInput: TransactionInput, unspentTransactionOutputs: UnspentTransactionOutput[]): number => {
    return findUnspentTransactionOutput(transactionInput.transactionOutputId, transactionInput.transactionOutputIndex, unspentTransactionOutputs).amount;
};

const findUnspentTransactionOutput = (transactionId: string, index: number, unspentTransactionOutputs: UnspentTransactionOutput[]): UnspentTransactionOutput => {
    return unspentTransactionOutputs.find((uTxO) => uTxO.transactionOutputId === transactionId && uTxO.transactionOutputIndex === index);
};

const getCoinbaseTransaction = (address: string, blockIndex: number): Transaction => {
    const t = new Transaction();
    const transactionInput: TransactionInput = new TransactionInput();
    transactionInput.signature = '';
    transactionInput.transactionOutputId = '';
    transactionInput.transactionOutputIndex = blockIndex;

    t.transactionInputs = [transactionInput];
    t.transactionOutputs = [new TransactionOutput(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
};

const signTransactionInput = (transaction: Transaction, transactionInputIndex: number,
                  privateKey: string, unspentTransactionOutputs: UnspentTransactionOutput[]): string => {
    const transactionInput: TransactionInput = transaction.transactionInputs[transactionInputIndex];

    const dataToSign = transaction.id;
    const referencedUnspentTransactionOutput: UnspentTransactionOutput = findUnspentTransactionOutput(transactionInput.transactionOutputId, transactionInput.transactionOutputIndex, unspentTransactionOutputs);
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
    const signature: string = toHexString(key.sign(dataToSign).toDER());

    return signature;
};

const updateUnspentTransactionOutputs = (transactions: Transaction[], unspentTransactionOutputs: UnspentTransactionOutput[]): UnspentTransactionOutput[] => {
    const newUnspentTransactionOutputs: UnspentTransactionOutput[] = transactions
        .map((t) => {
            return t.transactionOutputs.map((transactionOutput, index) => new UnspentTransactionOutput(t.id, index, transactionOutput.address, transactionOutput.amount));
        })
        .reduce((a, b) => a.concat(b), []);

    const consumedTransactionOutputs: UnspentTransactionOutput[] = transactions
        .map((t) => t.transactionInputs)
        .reduce((a, b) => a.concat(b), [])
        .map((transactionInput) => new UnspentTransactionOutput(transactionInput.transactionOutputId, transactionInput.transactionOutputIndex, '', 0));

    const resultingUnspentTransactionOutputs = unspentTransactionOutputs
        .filter(((uTxO) => !findUnspentTransactionOutput(uTxO.transactionOutputId, uTxO.transactionOutputIndex, consumedTransactionOutputs)))
        .concat(newUnspentTransactionOutputs);

    return resultingUnspentTransactionOutputs;
};

const processTransactions = (transactions: Transaction[], unspentTransactionOutputs: UnspentTransactionOutput[], blockIndex: number) => {

    if (!validateBlockTransactions(transactions, unspentTransactionOutputs, blockIndex)) {
        console.log('invalid block transactions');
        return null;
    }
    return updateUnspentTransactionOutputs(transactions, unspentTransactionOutputs);
};

const toHexString = (byteArray): string => {
    return Array.from(byteArray, (byte: any) => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
};

const getPublicKey = (privateKey: string): string => {
    return ec.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex');
};

const isValidTransactionInputStructure = (transactionInput: TransactionInput): boolean => {
    if (transactionInput == null) {
        console.log('transactionInput is null');
        return false;
    } else if (typeof transactionInput.signature !== 'string') {
        console.log('invalid signature type in transactionInput');
        return false;
    } else if (typeof transactionInput.transactionOutputId !== 'string') {
        console.log('invalid transactionOutputId type in transactionInput');
        return false;
    } else if (typeof  transactionInput.transactionOutputIndex !== 'number') {
        console.log('invalid transactionOutputIndex type in transactionInput');
        return false;
    } else {
        return true;
    }
};

const isValidTransactionOutputStructure = (transactionOutput: TransactionOutput): boolean => {
    if (transactionOutput == null) {
        console.log('transactionOutput is null');
        return false;
    } else if (typeof transactionOutput.address !== 'string') {
        console.log('invalid address type in transactionOutput');
        return false;
    } else if (!isValidAddress(transactionOutput.address)) {
        console.log('invalid TransactionOutput address');
        return false;
    } else if (typeof transactionOutput.amount !== 'number') {
        console.log('invalid amount type in transactionOutput');
        return false;
    } else {
        return true;
    }
};

const isValidTransactionStructure = (transaction: Transaction) => {
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
const isValidAddress = (address: string): boolean => {
    if (address.length !== 130) {
        console.log(address);
        console.log('invalid public key length');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    } else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};

export {
    processTransactions,
    signTransactionInput,
    getTransactionId,
    isValidAddress,
    validateTransaction,
    UnspentTransactionOutput,
    TransactionInput,
    TransactionOutput,
    getCoinbaseTransaction,
    getPublicKey,
    hasDuplicates,
    Transaction
};
