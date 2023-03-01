const { encrypt, decrypt } = require('../../lib/secure');

const testString = 'This is a test string 12390389450145f @#$%!#$!@^%!#$ja:"{#@$(%!F>';

test('Strings should match', () => {
    expect(decrypt(encrypt(testString))).toBe(testString);
})
