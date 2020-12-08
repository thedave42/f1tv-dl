const fs = require('fs');
const util = require('util');
const crypto = require('crypto');

const sCrypt = util.promisify(crypto.scrypt);

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
                await fs.promises.readFile(this.filename, {
                    encoding: 'utf8'
                })
        );
    }

    async create(attrs) {
        const records = await this.getAllRecords();
        const {email, pass} = attrs;

        const salt = crypto.randomBytes(8).toString('hex');
        const hashedBuff = await sCrypt(pass, salt, 64);

        const hashSaltPassword = `${hashedBuff.toString('hex')}.${salt}`;

        const record = {
            ...attrs,
            password: hashSaltPassword
        };

        records.push(record);

        await fs.promises.writeFile(
            this.filename,
            JSON.stringify(record, null, 2)
        );

        return record;
    }
}   

module.exports = SecureLocalData;