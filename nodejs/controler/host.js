'use strict';

const {Host} = require('../models/host');
const {SocketServerJson} = require('../models/socket_server_json');
const conf = require('../app').conf;

// console.log("Host", Host);
const host = new Host()
// console.log("host", host);

const socket = new SocketServerJson({
	socketFile: conf.socketFile,
	onData: async function(data, clientSocket) {
		let host = await Host.lookUp(data['domain'])  || {host: 'none'};
		console.log("host controller host", host);

		for (const [key, value] of Object.entries(host)) {
			host[key] = String(value);
		};

		clientSocket.write(JSON.stringify(host));
		if(host.ip){
			try{
				Host.addCache(data['domain'], host)
			}catch(error){
				console.error('Should never get this error...', error)
			}
		}
	},
	onListen: function(){
		console.log('listening')
	}
});
