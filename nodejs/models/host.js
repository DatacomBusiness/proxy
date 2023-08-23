'use strict';

const Table = require('../utils/redis_model');

class Host extends Table{
	static _key = 'host';
	static _keyMap = {
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'created_on': {default: function(){return (new Date).getTime()}},
		'updated_by': {default:"__NONE__", isRequired: false, type: 'string',},
		'updated_on': {default: function(){return (new Date).getTime()}, always: true},
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'ip': {isRequired: true, type: 'string', min: 3, max: 500},
		'targetPort': {isRequired: true, type: 'number', min:0, max:65535},
		'forcessl': {isRequired: false, default: true, type: 'boolean'},
		'targetssl': {isRequired: false, default: false, type: 'boolean'},
		'created_by': {isRequired: true, type: 'string', min: 3, max: 500},
		'is_cache': {default: false, isRequired: false, type: 'boolean',},
	}

	static lookUpObj = {};
	static __lookUpIsReady = false;

	static async addCache(host, parentOBJ){
		console.log("********addCache method called**********");
		try{
			await this.add({...parentOBJ, host, is_cache: true}, true).catch(err => {console.log("this.add err", JSON.stringify(err));})
			await Cached.add({
				host: host,
				parent: parentOBJ.host
			}).catch(err => {
				console.log("promise addCache error", err);
			});
		}catch(error){
			console.error('add cache error', {...parentOBJ, host, is_cache: true}, error)
			throw error;
		}
	}

	async bustCache(parent){
		console.log("********bustCache method called**********");
		try{
			console.log("parent", parent); // New host name
			let cached = await Cached.listDetail();
			console.log("44 cached", cached);
			for(let cache of cached){
				if(cache.parent == parent){
					console.log("cache", cache);
					let host = await Host.get(cache.host);
					console.log("cached host", host);
					await cache.remove("Cache");
				}
			}

		}catch(error){
			console.error('bust cache error', error)

			throw error;
		}
	}

	static async add(...args){
		try{
			let out = await super.add(...args)
			await this.buildLookUpObj()

			return out;
		} catch(error){
			throw error;
		}
	}

	async update(...args){
		try{
			let out = await super.update(...args)
			await this.bustCache(this.host)
			await Host.buildLookUpObj()

			return out;
		} catch(error){
			throw error;
		}
	}

	async remove(...args){
		console.log("-------- Hostjs Remove--------", ...args);
		try{
			let out = await super.remove(...args)
			await Host.buildLookUpObj()
			await this.bustCache(this.host)

			return out;
		} catch(error){
			throw error;
		}
	}

	static async buildLookUpObj(){
		return new Promise(async (resolve, reject) => {
			/*
			Build a look up tree for domain records in the redis back end to allow
			complex looks with wildcards.
			*/

			// Hold lookUp ready while the look up object is being built.
			this.__lookUpIsReady = false;
			this.lookUpObj = {};

			try{

				// Loop over all the hosts in the redis.
				for(let host of await this.list()){
					console.log("\n buildLookUpObj host", host);

					// Spit the hosts on "." into its fragments .
					let fragments = host.split('.');
					console.log("buildLookUpObj fragments", fragments);

					// Hold a pointer to the root of the lookup tree.
					let pointer = this.lookUpObj;

					// Walk over each fragment, popping from right to left. 
					while(fragments.length){
						let fragment = fragments.pop();

						// Add a branch to the lookup at the current position
						if(!pointer[fragment]){
							pointer[fragment] = {};
						}

						// Add the record(leaf) when we hit the a full host name.
						// #record denotes a leaf node on this tree.
						if(fragments.length === 0){
							pointer[fragment]['#record'] = await this.get(host)
						}

						// Advance the pointer to the next level of the tree.
						pointer = pointer[fragment];
						// console.log("buildLookUpObj pointer", pointer);
					}
				}

				// When the look up tree is finished, remove the ready hold.
				this.__lookUpIsReady = true;
				resolve("************************* Tree is built *************************")

			}catch(error){
				console.error(error);
				reject()
			}
		})
	}

	static lookUp(host){
		return new Promise((resolve, reject) => {
			console.log("*************** Peforming Host.lookUp Now ***************", host);
			/*
			Perform a complex lookup of @host on the look up tree.
			*/
	
			// Hold a pointer to the root of the look up tree
			let place = this.lookUpObj;
			console.log("this.lookUpObj", this.lookUpObj);
	
			// Get Host Prefix
			console.log("this.super.redisPrefix(this.prototype.constructor.name))", super.redisPrefix(this.prototype.constructor.name)); // works
			console.log("host.startsWith(super.redisPrefix(this.prototype.constructor.name))", host.startsWith(super.redisPrefix(this.prototype.constructor.name)));
	
			// if the host does not start with proxy_Host_, then return undefined
			if(host.endsWith(":latest")) resolve({"Valid": true, "host": host})
			else if(host == super.redisPrefix(this.prototype.constructor.name)) resolve({"Valid": true, "host": host})
			else if(host.startsWith(super.redisPrefix(this.prototype.constructor.name)) == false) resolve({"Valid": false, "host": host, "caught_by": "startsWith"})
			
			host = host.split(`${super.redisPrefix(this.prototype.constructor.name)}_`)[1]
			if(!host) resolve({"Valid": false, "host": host, "caught_by": "split"})
	
			// Hold the last passed long wild card.
			let last_resort = {};
	
			// Walk over each fragment of the host, from right to left
			console.log("host.split('.').reverse()", host.split('.').reverse());
			for(let fragment of host.split('.').reverse()){
				console.log("fragment", fragment);
	
				// If a long wild card is found on this level, hold on to it
				if(place['**']) last_resort = place['**'];
	
				// If we have a match for the current fragment, update the current pointer
				// A match in the lookup tree takes priority being a more exact match.
				if({...last_resort, ...place}[fragment]){
					place = {...last_resort, ...place}[fragment];
					// console.log("fragment was found in tree", place);
				// If we have a not exact fragment match, a wild card will do.
				}else if(place['*']){
					place = place['*']
					// console.log("place = place['*']", place);
				// If no fragment can be matched, continue with the long wild card branch.
				}else if(last_resort){
					place = last_resort;
					console.log("place", place);
					console.log("last_resort", last_resort);
				}
			}
	
				// console.log("returning place['#record'];", place['#record']);
			// After the tree has been traversed, see if we have leaf node to return. 
			if(place && place['#record']) resolve(place['#record']);
		}).catch(err => {
			console.log("promise error", err);
		})
	}

	static async lookUpReady(){
		/*
		Wait for the lookup tree to be built.
		*/

		// Check every 5ms to see if the look up tree is ready
		while(!this.__lookUpIsReady) await new Promise(r => setTimeout(r, 5));
		return true;
	}

}

class Cached extends Table{
	static _key = 'host';
	static _keyMap = {
		'host': {isRequired: true, type: 'string', min: 3, max: 500},
		'parent': {isRequired: true, type: 'string', min: 3, max: 500},
	}

}

(async function(){

	await Host.buildLookUpObj();
})()

module.exports = {Host};

(async function(){
try{


	// await Host.lookUpReady();

	// console.log(Host.lookUpObj)

	// console.log(await Host.listDetail())

// 	// console.log(Host.lookUpObj['com']['vm42'])

// 	// console.log('test-res', await Host.lookUp('payments.718it.biz'))

// 	let count = 6
// 	console.log(count++, Host.lookUp('payments.718it.biz').host === 'payments.718it.biz')
// 	console.log(count++, Host.lookUp('sd.blah.test.vm42.com') === undefined)
// 	console.log(count++, Host.lookUp('payments.test.com').host === 'payments.**')
// 	console.log(count++, Host.lookUp('test.sample.other.exmaple.com').host === '**.exmaple.com')
// 	console.log(count++, Host.lookUp('stan.test.vm42.com').host === 'stan.test.vm42.com')
// 	console.log(count++, Host.lookUp('test.vm42.com').host === 'test.vm42.com')
// 	console.log(count++, Host.lookUp('blah.test.vm42.com').host === '*.test.vm42.com')
// 	console.log(count++, Host.lookUp('payments.example.com').host === 'payments.**')	
// 	console.log(count++, Host.lookUp('info.wma.users.718it.biz').host === 'info.*.users.718it.biz')
// 	console.log(count++, Host.lookUp('infof.users.718it.biz') === undefined)
// 	console.log(count++, Host.lookUp('blah.biz') === undefined)
// 	console.log(count++, Host.lookUp('test.1.2.718it.net').host === 'test.*.*.718it.net')
// 	console.log(count++, Host.lookUp('test1.exmaple.com').host === 'test1.exmaple.com')
// 	console.log(count++, Host.lookUp('other.exmaple.com').host === '*.exmaple.com')
// 	console.log(count++, Host.lookUp('info.payments.example.com').host === 'info.**')
// 	console.log(count++, Host.lookUp('718it.biz').host === '718it.biz')


}catch(error){
	console.log('IIFE test area error:', error)
}
})()