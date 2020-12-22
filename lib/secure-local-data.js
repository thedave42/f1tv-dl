// https://www.geeksforgeeks.org/how-to-store-password-securely-in-your-local-custom-database-in-node-js/
//
//

const fs = require('fs');
const { encrypt, decrypt } = require('./secure');
const config = require('./config');

class SecureLocalData {

    constructor(filename) {
        if (!filename) {
            throw new Error('Filename is required to create data store.');
        }

        this.filename = `${filename}`;

        try {
            fs.accessSync(this.filename);
        }
        catch (e) {
            fs.writeFileSync(this.filename, '[]');
        }
    }

    async getAllRecords() {
        return JSON.parse(
            await fs.promises.readFile(this.filename, {
                encoding: 'utf8'
            })
        );
    }

    async add(key, value) {
        const records = await this.getAllRecords();

        const encryptedValue = encrypt(value);

        const record = {
            [key]: encryptedValue
        };

        const index = await this.getIndex(key);
        if (index !== -1) {
            records[index] = record;
        }
        else {
            records.push(record);
        }

        await fs.promises.writeFile(
            this.filename,
            JSON.stringify(records, null, 2)
        );

        return record;
    }

    async get(key) {
        const records = await this.getAllRecords();
        try {
            const encRecord = records.find(obj => (Object.keys(obj).shift() == key));
            const value = decrypt(encRecord[key]);
            return value;
        }
        catch (e) {
            return e.message;
        }
    }

    async getIndex(key) {
        const records = await this.getAllRecords();
        return records.findIndex(obj => Object.keys(obj).shift() == key);
    }
}

module.exports = SecureLocalData;