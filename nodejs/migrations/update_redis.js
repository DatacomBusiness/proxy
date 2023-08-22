'use strict';

const User = require("../models/user_redis");

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
];

(async function(){

	try {
		await client.connect()
		// console.log("User", User);
	
		// NOT PERFORMED HERE Go through the redis database and change any keys as necessary

		/* ---------------------DELETE BOGUS REDIS KEYS --------------------- */
	
		// Loop thru SMEMBERS and make delete all Keys that are not associated with the domains
		let allKeys = await client.KEYS("*")
		console.log("allKeys", allKeys);
		// Get list of hosts
		let hosts = await client.SMEMBERS('proxy_Host');
		console.log("hosts", hosts);

		// Find the SMEMBERS that contain *., *.*, etc and allow those domains with the proper subdomain pretext
		let starHostLen = hosts.filter(itm => itm.includes("*")).length // I assume that the user would want 1 subdomain, then 2, then 3, etc. Not just 5.
		console.log("starHostLen the total subdomains allowed", starHostLen);
				
		for(let key of allKeys){
			console.log("key", key);
			let exists = false;
			
			// Find base domain, and see how many subdomains this key has
			let parts = key.split(".");	let subDomainQty = parts.length -2; let arr = parts.slice(-2);	let domain = arr.join();
			// If subDomainQty is greater than starLenHost, then delete the keys that have more 
			if(subDomainQty > starHostLen) {
				await client.DEL(key)
			}
			
			// If does not match or start with the safeList, then delete it
			
			for(let safe of safeList) {
				if (key.startsWith(safe) || key == safe) {
					console.log("Key does start with safeWord");
					exists = true
				}
			}
			console.log("exists", exists);

			if(!exists) {
				await client.DEL(key)
			}
			
			let indx = hosts.findIndex(itm => itm == domain)
			
			if(indx >=0) {
				let host = hosts[indx]
				console.log("host", host);

				let created_on = await client.HGET('proxy_Host_'+host, 'updated');
				await client.HSET('proxy_Host_'+host, 'updated_on', created_on);
				await client.HSET('proxy_Host_'+host, 'updated_by', User.username);
			}
			
		}
	} catch(err) {
		console.log("update_redis err", err);
	}

	process.exit(0);
})()
