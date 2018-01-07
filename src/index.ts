import * as  bodyParser from 'body-parser';

import * as express from 'express';

import * as _ from 'lodash';

import {
    Sandgrain, getGlasschain, getUnspentTransactionOutputs, getLatestSandgrain, sendTransaction,
    generateRawNextSandgrain, generateNextSandgrain, generatenextSandgrainWithTransaction,
    handleReceivedTransaction, getMyUnspentTransactionOutputs,
    getAccountBalance, isValidSandgrainStructure, replaceChain, addSandgrainToChain
} from './glasschain';

import {
    connectToPeers,
    getSockets,
    initP2PServer
} from './p2p';

import {UnspentTransactionOutput} from './transaction';

import {getTransactionPool} from './transactionPool';

import {getPublicFromInbox, initInbox} from './inbox';

const httpPort: number = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT) || 6001;

const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.use(bodyParser.json());

    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res) => {
        res.send(getGlasschain());
    });

    app.get('/block/:hash', (req, res) => {
        const block = _.find(getGlasschain(), {'hash' : req.params.hash});
        res.send(block);
    });

    app.get('/transaction/:id', (req, res) => {
        const tx = _(getGlasschain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({'id': req.params.id});
        res.send(tx);
    });

    app.get('/address/:address', (req, res) => {
        const unspentTxOuts: UnspentTransactionOutput[] =
            _.filter(getUnspentTransactionOutputs(), (uTxO) => uTxO.address === req.params.address);
        res.send({'unspentTransactionOutputs': unspentTxOuts});
    });

    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(getUnspentTransactionOutputs());
    });

    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Sandgrain = generateRawNextSandgrain(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/mineBlock', (req, res) => {
        const newBlock: Sandgrain = generateNextSandgrain();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balance', (req, res) => {
        const balance: number = getAccountBalance();
        res.send({'balance': balance});
    });

    app.get('/address', (req, res) => {
        const address: string = getPublicFromInbox();
        res.send({'address': address});
    });

    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = generatenextSandgrainWithTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.post('/sendTransaction', (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;

            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            const resp = sendTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool());
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.post('/stop', (req, res) => {
        res.send({'msg' : 'stopping server'});
        process.exit();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
initInbox();