'use strict';

const {createClient} = require('redis');
const objValidate = require('../utils/object_validate');
const conf = require('../conf/conf');

const client = createClient({});
client.connect()

class Table{
	constructor(data){
		for(let key in data){
			this[key] = data[key];
		}
	}

	static redisPrefix(key){
		// console.log("redisPrefix conf", conf);
		// console.log("redisPrefix key", key);
		let response = `${conf.redis.prefix}${key}`
		console.log("redisPrefix response", response);
		return response;
	}

	static async get(index){
		console.log("********GET method called**********", index);
		try{
			// console.log("this.prototype.constructor.name", JSON.stringify(this.prototype.constructor.name));

			if(typeof index === 'object'){
				index = index[this._key];
			}

			var getPrefix = `${this.prototype.constructor.name}_${index}`
			// console.log("getPrefix", getPrefix);

			let result = await client.HGETALL(
				this.redisPrefix(getPrefix)
			);
			// console.log("get result", result);

			if(!Object.keys(result).length && this.prototype.constructor.name != "Cached"){
				let error = new Error('EntryNotFound');
				error.name = 'EntryNotFound';
				error.message = `${this.prototype.constructor.name}:${index} does not exists`;
				error.status = 404;
				throw error;
			}

			// Redis always returns strings, use the keyMap schema to turn them
			// back to native values.
			result = objValidate.parseFromString(this._keyMap, result);

			return new this.prototype.constructor(result);

		}catch(error){
			throw error;
		}

	}

	static async exists(index){
		try{
			await this.get(data);

			return true;
		}catch(error){
			return false;
		}
	}

	static async list(){
		console.log("********List Method called**********");
		// return a list of all the index keys for this table.
		try{
			let listMembers = await client.SMEMBERS(
				this.redisPrefix(this.prototype.constructor.name)
			);
			console.log("listMembers", listMembers);
			return listMembers

		}catch(error){
			throw error;
		}
	}

	static async listDetail(){
		console.log("********List Detail method called**********");
		// Return a list of the entries as instances.
		let out = [];

		for(let entry of await this.list()){
			out.push(await this.get(entry));
		}

		return out;
	}

	static async add(data){
		// Add a entry to this redis table.
		console.log("********Add method called**********");
		try{
			console.log("98 add data", data);
			console.log("99 this.prototype.constructor",this.prototype.constructor);
			// Validate the passed data by the keyMap schema.
			data = objValidate.processKeys(this._keyMap, data);

			// Do not allow the caller to overwrite an existing index key,
			if(data[this._key] && await this.exists(data)){
				let error = new Error('EntryNameUsed');
				error.name = 'EntryNameUsed';
				error.message = `${this.prototype.constructor.name}:${data[this._key]} already exists`;
				error.status = 409;

				throw error;
			}

			// Add the key to the members for this redis table
			await client.SADD(
				this.redisPrefix(this.prototype.constructor.name),
				data[this._key]
			);

			// Add the values for this entry.
			for(let key of Object.keys(data)){
				
				// console.log("data[this._key]", data[this._key]);

				var updatePrefix = `${this.prototype.constructor.name}_${data[this._key]}`
				// console.log("125 add updatePrefix", updatePrefix);

				await client.HSET(
					this.redisPrefix(updatePrefix), 
					key,
					objValidate.parseToString(data[key])
				);
			}

			// return the created redis entry as entry instance.
			return await this.get(data[this._key]);
		} catch(error){
			throw error;
		}
	}

	async update(data, key){
		console.log("********Update method called**********");
		// Update an existing entry.
		try{
			console.log("146 Update is called data", data);
			// console.log("update key", key);
			let oldHost = JSON.parse(JSON.stringify(data['edit_host']))
			// Set variables

			// Validate the passed data, ignoring required fields.
			data = objValidate.processKeys(this.constructor._keyMap, data, true);
			
			// Check to see if entry name changed.
			if(data[this.constructor._key] && data[this.constructor._key] !== this[this.constructor._key]){
				console.log("----151 update if executed ----");

				console.log("this.constructor.name", this.constructor.name);
				console.log("update conf.redis.prefix", conf.redis.prefix);
				console.log('data["edit_host"]', data["edit_host"]);
				console.log('data["host"]', data["host"]);
				// console.log("this[this.constructor._key", this[this.constructor._key]); // Old key
				
				let redisKey = this.redisPrefix(`${this.constructor.name}_${data["host"]}`)
				console.log("redisKey", redisKey); // New key
				var oldKey = this.redisPrefix(`${this.constructor.name}_${oldHost}`)
				console.log("oldKey, oldKey", oldKey);

				// Merge the current data into with the updated data 
				let newData = Object.assign({}, this, data);

				// Remove the updated failed so it doesnt keep it
				delete newData.updated;

				// Rename Key with new key

				let renamed = await client.RENAME(oldKey, redisKey)
				console.log("renamed", renamed);

				let prefixlHost = `${conf.redis.prefix}${this.constructor.name}`
				console.log("prefixlHost", prefixlHost);

				// update Members Set
				let removed = await client.SREM(`${conf.redis.prefix}${this.constructor.name}`, oldHost)
				console.log("removed", removed);
				let added = await client.SADD(`${conf.redis.prefix}${this.constructor.name}`, data["host"])
				console.log("added", added);

				// update Cache Set
				let removedC = await client.SREM(`${conf.redis.prefix}Cached`, oldHost)
				console.log("removedC", removedC);
				let addedC = await client.SADD(`${conf.redis.prefix}Cached`, data["host"])
				console.log("addedC", addedC);

				// Set new Host
				console.log("this.host1", this.host);
				this.host = data["host"]
				console.log("this.host2", this.host);

				// Loop through the data and Set redis HKEY
				for(let each in data) {
					console.log("each", each);
					console.log("data[each]", data[each]);

					await client.HSET(
						redisKey, // Key
						each, // Field
						String(data[each])  // value
					);
				}
				console.log("Completed updating record");

				// // Create a new record for the updated entry. If that succeeds,
				// // delete the old recored
				// let newObject = await this.constructor.add(newData);
				// console.log("newObject", newObject);

				// if(newObject){
				// 	await this.remove();
				// 	return newObject;
				// }
			}else{
				console.log("----227 else executed ----");
				// Update what ever fields that where passed.
				
				// Loop over the data fields and apply them to redis
				for(let key of Object.keys(data)){
					this[key] = data[key];
					
					await client.HSET(
						this.redisPrefix(`${this.constructor.name}_${data["host"]}`),
						key, String(data[key])
					);
				}
				console.log("Completed updating else record");
			}

			return this;
		
		} catch(error){
			// Pass any error to the calling function
			throw error;
		}
	}

	async remove(data){
		console.log("********Remove method called**********", data);
		console.log("remove data", data); // undefined
		console.log("this.constructor", this.constructor);
		console.log("this", this);
		console.log("Object.getOwnPropertyNames(this)", Object.getOwnPropertyNames(this));
		
		console.log("this.super.redisPrefix(this.prototype.constructor.name))", this.redisPrefix("Host")); 
		// Remove an entry from this table.

		try{
			console.log("remove this.constructor.name", this.constructor.name);
			// Remove the index key from the tables members list.
			let count
			if(data) {
				count = await client.DEL(
					this.redisPrefix(`${this.constructor.name}_${data}`)
				);
			} else {
				
				await client.SREM(
					this.redisPrefix(this.constructor.name),
					this[this.constructor._key]
				);
	
				// Remove the entries hash values.
				count = await client.DEL(
					this.redisPrefix(`${this.constructor.name}_${this[this.constructor._key]}`)
				);
	
				// Return the number of removed values to the caller.
				return count;
			}

			

		} catch(error) {
			throw error;
		}
	};

}


module.exports = Table;