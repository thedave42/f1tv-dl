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

    getAllRecords() {
        const fh = fs.readFileSync(this.filename, { encoding: 'utf8' });
        try {
            const records = JSON.parse(fh);
            return records;  
        }
        catch ( e ) {
            console.log(e);
        }
    }

    add(key, value) {
        const records = this.getAllRecords();

        const encryptedValue = encrypt(value);

        const record = {
            [key]: encryptedValue
        };

        const index = this.getIndex(key);
        if (index !== -1) {
            records[index] = record;
        }
        else {
            records.push(record);
        }

       fs.writeFileSync(
            this.filename,
            JSON.stringify(records, null, 2)
        );

        return record;
    }

    get(key) {
        const records = this.getAllRecords();
        try {
            const encRecord = records.find(obj => (Object.keys(obj).shift() == key));
            const value = decrypt(encRecord[key]);
            return value;
        }
        catch (e) {
            return null;
        }
    }

    getIndex(key) {
        const records = this.getAllRecords();
        return records.findIndex(obj => Object.keys(obj).shift() == key);
    }
}

module.exports = SecureLocalData;