"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bodyParser = require("body-parser");
const express = require("express");
const _ = require("lodash");
const glasschain_1 = require("./glasschain");
const p2p_1 = require("./p2p");
const transactionPool_1 = require("./transactionPool");
const inbox_1 = require("./inbox");
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;
const initHttpServer = (myHttpPort) => {
    const app = express();
    app.use(bodyParser.json());
    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    app.get('/blocks', (req, res) => {
        res.send(glasschain_1.getGlasschain());
    });
    app.get('/block/:hash', (req, res) => {
        const block = _.find(glasschain_1.getGlasschain(), { 'hash': req.params.hash });
        res.send(block);
    });
    app.get('/transaction/:id', (req, res) => {
        const tx = _(glasschain_1.getGlasschain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({ 'id': req.params.id });
        res.send(tx);
    });
    app.get('/address/:address', (req, res) => {
        const unspentTxOuts = _.filter(glasschain_1.getUnspentTransactionOutputs(), (uTxO) => uTxO.address === req.params.address);
        res.send({ 'unspentTransactionOutputs': unspentTxOuts });
    });
    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(glasschain_1.getUnspentTransactionOutputs());
    });
    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(glasschain_1.getMyUnspentTransactionOutputs());
    });
    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock = glasschain_1.generateRawNextSandgrain(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        }
        else {
            res.send(newBlock);
        }
    });
    app.post('/mineBlock', (req, res) => {
        const newBlock = glasschain_1.generateNextSandgrain();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        }
        else {
            res.send(newBlock);
        }
    });
    app.get('/balance', (req, res) => {
        const balance = glasschain_1.getAccountBalance();
        res.send({ 'balance': balance });
    });
    app.get('/address', (req, res) => {
        const address = inbox_1.getPublicFromInbox();
        res.send({ 'address': address });
    });
    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = glasschain_1.generatenextSandgrainWithTransaction(address, amount);
            res.send(resp);
        }
        catch (e) {
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
            const resp = glasschain_1.sendTransaction(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
    app.get('/transactionPool', (req, res) => {
        res.send(transactionPool_1.getTransactionPool());
    });
    app.get('/peers', (req, res) => {
        res.send(p2p_1.getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        p2p_1.connectToPeers(req.body.peer);
        res.send();
    });
    app.post('/stop', (req, res) => {
        res.send({ 'msg': 'stopping server' });
        process.exit();
    });
    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};
initHttpServer(httpPort);
p2p_1.initP2PServer(p2pPort);
inbox_1.initInbox();
//# sourceMappingURL=index.js.map