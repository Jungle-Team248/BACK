import crypto from 'crypto';
const dbpool = require('../lib/db');

const createSalt = () =>
    new Promise((resolve, reject) => {
        crypto.randomBytes(64, (err, buf) => {
            if (err) reject(err);
            resolve(buf.toString('base64'));
        });
    });

const createHashedPassword = (plainPassword) =>
new Promise(async (resolve, reject) => {
    const salt = await createSalt(); // 소금 만들어서 대입
    crypto.pbkdf2(plainPassword, salt, 9999, 64, 'sha512', (err, key) => {
        if (err) reject(err);
        resolve({ password: key.toString('base64'), salt });
    });
}); 

const makePasswordHashed = (userId, plainPassword) =>
    new Promise(async (resolve, reject) => {
    
        // userId인자로 해당 유저 salt를 가져오는 부분
        
        const [data] = await dbpool.query('SELECT salt, pass FROM `USER` WHERE `userid` = ?', userId);

        if (!data.length){
            resolve(false);
        }
        
        // 위에서 가져온 salt와 plainPassword를 다시 해시 암호화 시킴. (비교하기 위해)
        crypto.pbkdf2(plainPassword, data[0].salt, 9999, 64, 'sha512', (err, key) => {
            if (err) reject(err);
            if (data[0].pass === key.toString('base64')){
                resolve(true);
            } else {
                // 로그인 실패시
                resolve(false);
            }
        });
    });

export {createHashedPassword, makePasswordHashed};