"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bodyParser = require("body-parser");
const express = require("express");
const glasschain_1 = require("./glasschain");
/*
import {connectToPeers, getSockets, initP2PServer} from './p2p';
import {UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {getPublicFromWallet, initWallet} from './wallet';
*/
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;
const initHttpServer = (httpPort) => {
    if (typeof httpPort !== 'number') {
        console.log('Error: Invalid HTTP port provided. Please provide a new HTTP port and try again.');
        return;
    }
    const app = express();
    app.use(bodyParser.json());
    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    app.get('/blocks', (req, res) => {
        res.send(glasschain_1.getGlassChain());
    });
    app.post('/mineBlock', (req, res) => {
        const newSandGrain = glasschain_1.generateNextSandGrain(req.body.data);
        res.send(newSandGrain);
    });
    /*
    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });

    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    })
    */
    app.listen(httpPort, () => {
        console.log('Listening HTTP on port: ' + httpPort);
    });
    app.post('/stop', (req, res) => {
        res.send({ 'msg': 'Stopping Server' });
        process.exit();
    });
};
initHttpServer(httpPort);
//initP2PServer(p2pPort);
//# sourceMappingURL=index.js.map