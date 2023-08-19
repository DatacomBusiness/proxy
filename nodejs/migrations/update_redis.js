'use strict';

const User = require("../models/user_redis")

const {createClient} = require('redis');

const client = createClient({});

var safeList = [
	"auth",
	"user", 
	"proxy_AuthToken",
	"proxy_host",
	"proxy_User",
	"proxy_Host",
	"token_auth"
]

(async function(){

	try {
		await client.connect()
		// Set up client and make sure it is loaded correctly
	
		// Go through the redis database and change any keys as necessary
	
		// Loop thru SMEMBERS and make delete all Keys that are not associated with the domains
		let allKeys = await client.KEYS("*")
		
		for(let key in allKeys){
			// Loop through each key and if does not match or start witht he safeList, then delete it
			let hosts = await client.SMEMBERS('proxy_Host');
			console.log("hosts", hosts);
	
			for(let safe of safeList) {
				if (!key.startswith(safe) || !key.includes(safe))
					await client.DEL(key)
			}
	
			let created_on = await client.HGET('proxy_Host_'+host, 'updated');
			await client.HSET('host_'+host, 'updated_on', created_on);
			await client.HSET('host_'+host, 'updated_by', User.username);
		}
	} catch(err) {
		console.log("update_redis err", err);
	}

	process.exit(0);
})()
