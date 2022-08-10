import express from "express";
import { isLoggedIn } from './authMiddle';
import {userInfo} from '../server.js';
const router = express.Router();
const dbpool = require('../lib/db');

router.post('/friendinfo', isLoggedIn, async (req, res) => {
  try {
    const [[pk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', req.body.userid);
    const [data] = await dbpool.query('SELECT userid, profile_img FROM USER a join CITIZEN b on a.id = b.friendid WHERE b.myid=?;', pk.id);

    let friendInfo = {};

    data.forEach((info, index) => {
      if (userInfo[info.userid]) {
        friendInfo[info.userid] = [1, info['profile_img']];
      } else {
        friendInfo[info.userid] = [0, info['profile_img']];
      }
    })

    res.send(friendInfo);
  } catch(err){
    res.send('errrrrrrrrrr!');
  }
});

router.post('/addfriend', isLoggedIn, async (req, res) => {
  const friendId = req.body.userid;
  const myId = req.user.userid;
  if (friendId === myId){
    res.send("INVALID_USER");
    return;
  }
  try {
    const [[friendPk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', friendId);
    if (friendPk) {
      const [[myPk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', myId);
      const [[isExist]] = await dbpool.query('SELECT * FROM CITIZEN where myid=? AND friendid=?', [myPk.id, friendPk.id]);
      if (!isExist) {
        dbpool.query("insert into CITIZEN(myid, friendid) values (?,?)", [myPk.id, friendPk.id]);
        dbpool.query("insert into CITIZEN(myid, friendid) values (?,?)", [friendPk.id, myPk.id]);
        res.send("SUCCESS");
      } else {
        res.send("ALREADY_EXIST");
      }
    } else {
      res.send("INVALID_USER");
    }
  } catch (err) {
    console.log(err);
    res.send('error!');
  }
})

router.post('/friendDel', isLoggedIn, async (req, res) => {
  try {
    const friendId = req.body.delid;
    const myId = req.body.userid;

    const [[friendPk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', friendId);
    if (friendPk) {
      const [[myPk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', myId);
      const [[isExist]] = await dbpool.query('SELECT * FROM CITIZEN where myid=? AND friendid=?', [myPk.id, friendPk.id]);

      if (isExist){
        await dbpool.query("DELETE FROM CITIZEN WHERE (myId = ?) and (friendid = ?)", [myPk.id, friendPk.id]);
        await dbpool.query("DELETE FROM CITIZEN WHERE (myId = ?) and (friendid = ?)", [friendPk.id, myPk.id]);
        res.send("SUCCESS");
      } else {
        res.send("SUCCESS");
      }
    } else {
      res.send("INVALID_USER");
    }
    // res.send([req.body.userid, req.body.delid]);
  } catch(err) {
    res.send('errrororrrorrrr');
  }
})

module.exports = router;