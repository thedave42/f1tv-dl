const config = require('./config');
const crypto = require('crypto');

const cryptokey = crypto.scryptSync(config.DS_CRYPT_KEY_SEED, 'salt', 24);
const algorithm = config.DS_CRYPT_ALGO;
const iv = crypto.randomBytes(16);

const encrypt = (value) => {
    const cipher = crypto.createCipheriv(algorithm, cryptokey, iv);
    const hashSaltValue = cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
    return `${hashSaltValue}.${iv.toString('hex')}`;
}

const decrypt= (value) => {
    const [encValue, ivString] = value.split('.')
    const locIv = Buffer.from(ivString, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, cryptokey, locIv);
    const decrypted = decipher.update(encValue, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
}

module.exports = {
    encrypt,
    decrypt
}
