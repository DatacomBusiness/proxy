'use strict';

const {createClient} = require('redis');
const objValidate = require('../utils/object_validate');
const conf = require('../conf/conf');

const client = createClient({});
client.connect()

function redisPrefix(key){
	// console.log("redisPrefix conf", conf);
	// console.log("redisPrefix key", key);
	let response = `${conf.redis.prefix}${key}`
	console.log("redisPrefix response", response);
	return response;
}

class Table{
	constructor(data){
		for(let key in data){
			this[key] = data[key];
		}
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
				redisPrefix(getPrefix)
			);
			// console.log("get result", result);

			if(!Object.keys(result).length){
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
		// return a list of all the index keys for this table.
		try{
			return await client.SMEMBERS(
				redisPrefix(this.prototype.constructor.name)
			);

		}catch(error){
			throw error;
		}
	}

	static async listDetail(){
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
				redisPrefix(this.prototype.constructor.name),
				data[this._key]
			);

			// Add the values for this entry.
			for(let key of Object.keys(data)){
				
				// console.log("data[this._key]", data[this._key]);

				var updatePrefix = `${this.prototype.constructor.name}_${data[this._key]}`
				// console.log("125 add updatePrefix", updatePrefix);

				await client.HSET(
					redisPrefix(updatePrefix), 
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
			console.log("144Update is called data", data);
			// console.log("update key", key);

			// Set variables
			let updatePrefix = `${this.constructor.name}_${this[this.constructor._key]}`
			// Validate the passed data, ignoring required fields.
			data = objValidate.processKeys(this.constructor._keyMap, data, true);
			
			// Check to see if entry name changed.
			if(data[this.constructor._key] && data[this.constructor._key] !== this[this.constructor._key]){
				console.log("----151 update if executed ----");

				console.log("this.constructor", this.constructor);
				console.log("this[this.constructor._key", this[this.constructor._key]);
				
				let redisKey = redisPrefix(updatePrefix)
				// console.log("156 add updatePrefix", updatePrefix);

				// Merge the current data into with the updated data 
				let newData = Object.assign({}, this, data);

				// Remove the updated failed so it doesnt keep it
				delete newData.updated;
				// Loop through the data and Set redis HKEY

				for(let each in data) {
					console.log("each", each);
					console.log("data[each]", data[each]);

					await client.HSET(
						redisKey, // Key
						each, // Field
						data[each]   // value
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
				console.log("----188 else executed ----");
				// Update what ever fields that where passed.
				
				// Loop over the data fields and apply them to redis
				for(let key of Object.keys(data)){
					this[key] = data[key];
					
					await client.HSET(
						redisPrefix(updatePrefix),
						key, String(data[key])
					);
				}
				console.log("Completed updating record");
			}

			return this;
		
		} catch(error){
			// Pass any error to the calling function
			throw error;
		}
	}

	async remove(data){
		console.log("********Remove method called**********");
		// Remove an entry from this table.

		try{
			console.log("removing data for",this.constructor.name);
			// Remove the index key from the tables members list.

			await client.SREM(
				redisPrefix(this.constructor.name),
				this[this.constructor._key]
			);

			// Remove the entries hash values.
			let count = await client.DEL(
				redisPrefix(`${this.constructor.name}_${this[this.constructor._key]}`)
			);

			// Return the number of removed values to the caller.
			return count;

		} catch(error) {
			throw error;
		}
	};

}


module.exports = Table;