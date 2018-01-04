import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as _ from 'lodash';
import {
	SandGrain, generateNextSandGrain, getGlassChain
} from './glasschain';

/*
import {connectToPeers, getSockets, initP2PServer} from './p2p';
import {UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {getPublicFromWallet, initWallet} from './wallet';
*/

const httpPort: number = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT) || 6001;

const initHttpServer = (httpPort: number) => {
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
		res.send(getGlassChain());
	});

	app.post('/mineBlock', (req, res) => {
		const newSandGrain: SandGrain = generateNextSandGrain(req.body.data);
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
	})

	app.post('/stop', (req, res) => {
		res.send({'msg': 'Stopping Server'});
		process.exit();
	});
};

initHttpServer(httpPort);
//initP2PServer(p2pPort);
