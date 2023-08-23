'use strict';

// Use this file to clean up your redis keys.

const User = require("../models/user_redis");

const {createClient} = require('redis');

const client = createClient({});

const {Host} = require("../models/host")
console.log("**************** update_host.js ****************");
// console.log("Host", Host);

var safeList = [ // Handles all keys other then the Host keys
	"proxy_AuthToken",
	"proxy_User",
	// "proxy_Cached"
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
		var listToDelete = []
		// Get list of hosts
		// let hosts = await client.SMEMBERS('proxy_Host');
		// console.log("hosts", hosts);

		// Build Lookup tree
		let tree = await Host.buildLookUpObj()
		console.log("tree", tree);

		// // Find the SMEMBERS that contain *., *.*, etc and allow those domains with the proper subdomain pretext
		// let starHostLen = hosts.filter(itm => itm.includes("*")).length // I assume that the user would want 1 subdomain, then 2, then 3, etc. Not just 5.
		// console.log("starHostLen the total subdomains allowed", starHostLen);
				
		for(let key of allKeys){
			console.log("\nupdate_redis.js KEY", key);
			let exists = false;
										
			// If does not match or start with the safeList, then delete it. ***Covers all classes other than the Host Class***
			for(let safe of safeList) {
				if (key.startsWith(safe) || key == safe) {
					console.log("Key: ", key, "does start with safeList word: ", safe);
					exists = true
					break;
				} 
			}
			console.log("does exists", exists);

			if(!exists) {
				// Do a lookup to see if it exists in the tree
				let lookUpKey = await Host.lookUp(key)
				console.log("lookUpKey", lookUpKey);

				if(lookUpKey["Valid"] == false) {
					exists = false
					listToDelete.push(key)
										
					console.log("!exists await client.DEL(key)");
					// await client.DEL(key)
				} 
			}
			

			// Just for record keeping
			// let indx = hosts.findIndex(itm => itm == domain)
			
			// if(indx >=0) {
			// 	let host = hosts[indx]
			// 	console.log("host", host);

			// 	let created_on = await client.HGET('proxy_Host_'+host, 'updated');
			// 	await client.HSET('proxy_Host_'+host, 'updated_on', created_on);
			// 	await client.HSET('proxy_Host_'+host, 'updated_by', User.username);
			// }
			
		}
		console.log("listToDelete",listToDelete);
	} catch(err) {
		console.log("update_redis err", err);
	}

	process.exit(0);
})()
