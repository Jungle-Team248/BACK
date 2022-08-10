const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const { isLoggedIn, isNotLoggedIn } = require('./authMiddle');
const dbpool = require('../lib/db');

import {userInfo} from '../server';
import {createHashedPassword} from '../passport/salted'

/* Login 여부 확인용 */
router.get('/', (req, res) => {
  const authenticated = req.isAuthenticated();
  if (authenticated && !userInfo[req.user.userid]) {
    userInfo[req.user.userid] = {userId: req.user.userid};
  }
  const data = {auth: authenticated, user: req.user};
  res.send(data);
});


/* hyeRexx : join */
router.post('/user/join', async (req, res) => {
    const joinInfo = req.body;

    const [[[idCheck], [nickCheck], [emailCheck]]] = await dbpool.query("\
        SELECT userid FROM STD248.USER where userid = ?;\
        SELECT userid FROM STD248.USER where nickname = ?;\
        SELECT userid FROM STD248.USER where email = ?;"
        ,[joinInfo.id, joinInfo.nickname, joinInfo.email]);  

    const id = idCheck === undefined;
    const nick = nickCheck === undefined;
    const email = emailCheck === undefined;

    console.log(idCheck, nickCheck, emailCheck);
    console.log(id, nick, email);

    if (id && nick && email) {
        const { password, salt } = await createHashedPassword(joinInfo.pass);
        
        const sqlRes = await dbpool.query("insert into STD248.USER (userid, pass, nickname, email, salt)\
        values (?, ?, ?, ?, ?);", [joinInfo.id, password, joinInfo.nickname, joinInfo.email, salt]);
        
        res.send({
            result : 1
        })
    } else {
        res.send({
            result : 0,
            idCheck: id,
            emailCheck: email
        });
    }
});

/* hyeRexx : END */

// login 요청
router.post('/login', isNotLoggedIn, (req, res, next) => {
  // 'local'로 되어있기 때문에 local strategy가 실행된 뒤 done이 호출되면 결과값이 여기 인자로 들어옴
  passport.authenticate('local', (authError, user, info) => {
    // local stragegy에서 done(err)가 처리된 경우
    if (authError) {
      console.error(authError);
      return next(authError); // 에러처리 미들웨어로 보냄
    }
    // 로그인에 실패한 경우
    if (!user) {
      return res.send(info.message);
    }
    // 로그인이 성공된 경우 index.js에 있는 serializeUser를 실행함
    return req.login(user, loginError => {
      // deserializeUser에서 done()이 되면 실행됨. done(err)일 경우
      if (loginError) {
        console.error(loginError);
        return next(loginError);
      }
      return res.send('success');
    });
  })(req, res, next); // authenticate의 인자로 req, res, next 전달 위해 붙여줌
});

// logout 요청
router.post('/logout', isLoggedIn, (req, res, next) => {
  // 로그아웃 처리 및 세션 destroy
  req.logout((err) => {
    if (err) {return next(err)}
    req.session.destroy();
    res.send('success');
  });
});

module.exports = router;
