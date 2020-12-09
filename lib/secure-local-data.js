// https://www.geeksforgeeks.org/how-to-store-password-securely-in-your-local-custom-database-in-node-js/
//
//

require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const cryptokey = crypto.scryptSync(process.env.DS_CRYPT_KEY_SEED, 'salt', 24);
const algorithm = 'aes-192-cbc';
const iv = crypto.randomBytes(16);

class SecureLocalData {

    constructor(filename) {
        if (!filename) {
            throw new Error('Filename is required to create data store.');
        }

        this.filename = filename;

        try {
            fs.accessSync(this.filename);
        }
        catch (e) {
            fs.writeFileSync(this.filename,'[]');
        }
    }

    async getAllRecords() {
        return JSON.parse(
                fs.readFileSync(this.filename, {
                    encoding: 'utf8'
                })
        );
    }

    async add(key, value) {
        const records = await this.getAllRecords();
        
        const encryptedValue = await this.encrypt(value);

        const record = {
            [key]: `${encryptedValue}.${iv.toString('hex')}`
        };

        const index = await this.getIndex(key);
        console.log('index is', index);
        if ( index !== -1 ) {
            console.log(`Updating existing record for key ${key}.`);
            records[index] = record;
        } 
        else {
            console.log(`Creating record for key ${key}.`);
            records.push(record);
        }

        fs.writeFileSync(
            this.filename,
            JSON.stringify(records, null, 2)
        );

        return record;
    }

    async get(key) {
        const records = await this.getAllRecords();
        const encRecord = records.find( obj => (Object.keys(obj).shift() == key));
        const value = await this.decrypt(encRecord[key]);
        const record = {
            [key]: value
        }
        return record;
    }

    async getIndex(key) {
        const records = await this.getAllRecords();
        return records.findIndex( obj => Object.keys(obj).shift() == key);
    }

    async encrypt(value) {
        const cipher = crypto.createCipheriv(algorithm, cryptokey, iv);
        const hashSaltValue = cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
        return hashSaltValue;
    }

    async decrypt(value) {
        const [encValue, ivString] = value.split('.')
        const locIv = Buffer.from(ivString, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, cryptokey, locIv);
        const decrypted = decipher.update(encValue, 'hex', 'utf8') + decipher.final('utf8');
        return decrypted;
    }

}   

module.exports = SecureLocalData;

/*
const DataStore = require('./lib/secure-local-data');

const ds = new DataStore('data.json');

ds.add('password', 'ThisIsTheDawningOfTheAgeOfAquariusTheDawningOfTheAgeOfAquariusTheDawningOfTheAgeOfAquarius')
.then( (record) => {
    console.log(record);
    return ds.get('password');
})
.then( (record) => {
    //console.log('fetched token');
    console.log(record);
})
.catch( (e) => {
    console.error(e);
});
*/