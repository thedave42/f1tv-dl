const DataStore = require('../../lib/secure-local-data');
const fs = require('fs');
const { encrypt, decrypt } = require('../../lib/secure');

const testValue = 'This is a test string 12390389450145f @#$%!#$!@^%!#$ja:"{#@$(%!F>';
const testKey = 'token';
const testFile = './datastore-test.json';

test('Datastore file is successfully created', () => {
    const ds = new DataStore(testFile);
    expect(fs.existsSync(testFile)).toBeTruthy();
});

test('Datastore file is readable', () => {
    const ds = new DataStore(testFile);
    let rOk = false;
    try {
        fs.accessSync(testFile, fs.constants.R_OK);
        rOk = true;
    }
    catch (e) {
        rOk = false;
    }
    expect(rOk).toBeTruthy();
});

test('Datastore file is writeable', () => {
    const ds = new DataStore(testFile);
    let wOk = false;
    try {
        fs.accessSync(testFile, fs.constants.W_OK);
        wOk = true;
    }
    catch (e) {
        wOk = false;
    }
    expect(wOk).toBeTruthy();
});

test('Add a value to the datastore and make sure it\'s encrypted', () => {
    const ds = new DataStore(testFile);
    ds.add(testKey, testValue)    
        .then( record => {
            expect(record[testKey]).toBe(encrypt(testValue)); 
        })
});

test('Get a value from the datastore and make sure it\'s decrypted', async () => {
    const ds = new DataStore(testFile); 
    let ok = false;
    try {
        fs.accessSync(testFile, fs.constants.R_OK | fs.constants.W_OK);
        ok = true;
    }
    catch (e) {
        ok = false;
    }
    expect(ok).toBeTruthy();    
    
    const value = await ds.get(testKey);
    expect(value).toBe(testValue);
});