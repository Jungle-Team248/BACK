const passport = require('passport');
const local = require('./localStrategy');
const dbpool = require('../lib/db');
import {userInfo} from '../server.js'

module.exports = () => {
    /*
     * Serialization : 객체를 직렬화하여 전송 가능한 형태로 만듦
     * Deserialization : 직렬화된 파일 등을 역으로 직렬화하여 객체의 형태로 만듦
    */
    // 최초 로그인 성공시에 session에 userid 저장
    passport.serializeUser((req, user, done) => {
        process.nextTick(()=>{
            // req.session에 userid만 저장함
            done(null, user.userid);
        });
    });

// 로그인 이후 접근시 session()을 통해 매번 실행되며 로그인한 회원의 req.user에 유저정보를 복구함
    passport.deserializeUser(async (id, done) => {
        if (!userInfo[id]) {
            userInfo[id] = {userId: id, gameId: null, state: true};
        }
        dbpool.query('SELECT userid, profile_img FROM USER WHERE userid=?', id).then(user => done(null, user[0][0])).catch(err => done(err));
    });

    local();
};