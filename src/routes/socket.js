import { Server } from 'socket.io';
import { instrument } from "@socket.io/admin-ui";
import socketEvent from '../socket-events';
import {userInfo} from '../server.js'
import Game from '../lib/gamemode.js'
// import Game from './dummy.js'

let games = {};

module.exports = (server) => {
    const ioServer = new Server(server, {
        cors: {
            // origin: ["https://admin.socket.io", "https://d17xe7xfw04d2o.cloudfront.net"], // 진호
            origin: ["https://admin.socket.io", "https://d2bxvfgokknit.cloudfront.net"], // 혜린
            // origin: ["https://admin.socket.io", "https://d2wm85v592lxtd.cloudfront.net"], // 재관
            // origin: ["https://admin.socket.io", "https://d1cbkw060yb1pg.cloudfront.net"], // 해인
            credentials: true
        },
    });

    const connectedClient = {};
    
    instrument(ioServer, {auth: false});
    
    // // Socket 및 webRTC 관련 Settings
    // function publicRooms() {
    //     const {sockets: {adapter: {sids, rooms}}} = ioServer;
    //     const publicRooms = [];
    //     rooms.forEach((_, key) => {
    //         if(sids.get(key) === undefined) {
    //             publicRooms.push(key);
    //         }
    //     });
    //     return publicRooms;
    // }
    
    // // room에 몇 명 있나 확인용
    // function countRoom(roomId) {
    //     return ioServer.sockets.adapter.rooms.get(roomId)?.size;
    // }
    
    ioServer.on("connection", (socket) => {

        socket.onAny((event) => {
            // console.log(`socket의 id : ${socket.id}`)
            // console.log(`Socket event : ${event}`);
        });

        socket.on('loginoutAlert', (userId, status) => {
            // console.log('loginoutAlert', userId, status);
            (status === 0) && (delete userInfo[userId]);
            socket.broadcast.emit("friendList", userId, status);
        });

        socket.on("checkEnterableRoom", done => {
            const roomId = + new Date();
            done(roomId);
        });

         // socket enterRoom event 이름 수정 확인 필요
        socket.on("enterRoom", (data, roomId, done) => {
            console.log(`enterRoom의 ${roomId}`);

            socket.room = roomId;
            socket.join(roomId);
            done(games[roomId].host);
            console.log("debug__ socket join? ", socket.userId, socket.rooms);
            console.log(roomId, games[roomId].player.map((user) => user.userId));
            // 새로운 유저 입장 알림
            socket.to(roomId).emit("notifyNew", data);
        });

        socket.on("notifyOld", (data, toSocketId) => {
            console.log("debug__ notifyOld : ", data);
            socket.to(toSocketId).emit("notifyOld", data);
        });

        socket.on("offer", async (offer, offersSocket, newbieSocket, offersId) => {
            console.log("new offer received");
            socket.to(newbieSocket).emit("offer", offer, offersSocket, offersId);
        });
    
        socket.on("answer", (answer, offersSocket, newbieId) => {
            socket.to(offersSocket).emit("answer", answer, newbieId);
        });
    
        socket.on("ice", (ice, sendersId, othersSocket) => {
            socket.to(othersSocket).emit("ice", ice, sendersId);
        });
        
        socket.on('userinfo', (id) => {
            const user = userInfo[id];
            user["socket"] = socket.id;
            socket["userId"] = id;
        });
        
        socket.on("new_message", (msg, room, done) => {
            socket.to(room).emit("new_message", msg);
            done();
        });

        console.log(`A client has connected (id: ${socket.id})`);
        if (!(socket.id in connectedClient)) {
            connectedClient[socket.id] = {};
        } // client 관리용
        
        // ingame utility btn을 통해 exit처리된 플레이어
        // game, socket 양쪽 모두 처리 필요
        socket.on("exit", (userId, roomId, done) => { 
            console.log("someone exiting", userId, roomId);
            
            // server reboot 대비 : client에서 잘못된 roomId로 접근하는 경우 방지
            if(games[roomId]) {
                games[roomId].exitGame(userInfo[userId]);
                games[roomId].isEmpty ? delete games[roomId] : null;
            }
            
            socket.leave(roomId);
            socket.room = null;
            done();
        });

        socket.on("disconnecting", () => {
            console.log("someone disconnecting", socket.userId);
        });
        
        socket.on("disconnect", () => {
            console.log(`Client disconnected (id: ${socket.id})`);

            const user = userInfo[socket.userId];
            socket.broadcast.emit("friendList", socket.userId, 0);
            if (user?.state === false) {
                const roomId = user.gameId;
                games[roomId].exitGame(user.userId);
                console.log(roomId, games[roomId].player.map((user) => user.userId));
                if (games[roomId].isEmpty()) {
                    delete games[roomId];
                    console.log(`${roomId} destroyed`);
                }
            }
            socket.rooms.forEach(room => {
                room != socket.id && socket.leave(room);
            });
            
            delete userInfo[socket.userId];
            delete connectedClient[socket.id];
            console.log(socket.userId, userInfo);
            console.log(games);
        }); // client 관리용

        // 여러 명의 socketId 반환
        socket.on('listuserinfo', (listuserid, done) => {
            let listsocketid = new Array();
            for (var i = 0; i < listuserid.length; i++) {
                // console.log(`유저의 socket id ${userInfo[listuserid[i]]["socket"]}`);
                listsocketid.push(userInfo[listuserid[i]]["socket"]);
            }

            // console.log(`socketid 리스트 ${listsocketid}`);
            
            // 초대하고 싶은 사람 리스트 반환
            done(listsocketid);
            // socket.emit("listsocketid", listsocketid);
        });

        // 초대 보내기
        socket.on("sendinvite",(listsocketid, roomId, myId, done) => {
            for (var i = 0; i < listsocketid.length; i++) {
                // console.log(`초대하는 socket id ${listsocketid[i]}`);
                ioServer.to(listsocketid[i]).emit("getinvite", roomId, myId);
            }
            // HOST가 방으로 이동
            done(roomId);
        });

        // canvas add
        socket.on(socketEvent.DRAW, (data) => {
            const {
              prev,
              curr,
              color,
              thickness,
            } = data;
        });
    
        socket.on(socketEvent.DRAW, (data) => {
            const client = connectedClient[socket.id];
    
            client.prev = client.curr || data;
            client.curr = data;    
    
            const currdata = {
                prev: {
                    x: client.prev.x,
                    y: client.prev.y,
                },
                curr: {
                    x: client.curr.x,
                    y: client.curr.y,
                },
                color: client.curr.color,
                thickness: client.curr.thickness,
            }  
            
            if (client.curr.color == '#ffffff') {
                currdata.thickness = 30;
            }
    
            socket.to(data.name).emit(socketEvent.DRAW, currdata);
            socket.emit(socketEvent.DRAW, currdata);
        });
    
        socket.on(socketEvent.DRAW_BEGIN_PATH, () => {
            connectedClient[socket.id].curr = null;
        });

        
        /*** for A Game : hyeRexx ***/

        // request from a host player in the lobby
        // need client!
        socket.on("makeGame", (data, done) => {
            let user = userInfo[data.userId];
            if (user === undefined) {
                done(false);
                return null;
            } else if (user.state === false) {
                done(false);
                return null;
            }
            console.log(`In makeGame : user is ${user}`);
            games[data.gameId] = new Game(data.gameId);
            games[data.gameId].joinGame(user, socket);
            // console.log("debug__ : games object :", games);
            done(data.gameId);
        }) 

        // request from a general players in the lobby 
        // need client!
        socket.on("joinGame", (data, done) => {
            let user = userInfo[data.userId];
            // 서버가 restart되어서 userInfo가 없을 때 클라이언트에 갱신 신호
            if (user === undefined) {
                done(false);
                return null;
            // user.state가 false, 즉, 게임 중인 경우에는 게임 참가 불가
            } else if (user.state === false) {
                done(false);
                return null;
            }
            console.log(`In joinGame : user is ${user}`);
            let thisGameId;
            // 랜덤 입장 요청 : from START btn.
            if (data.gameId === 0) {
                const gameIds = Object.keys(games);
                const gameCount = gameIds.length;
                let i = 0;
                for (; i<gameCount; i++) {
                    if (games[gameIds[i]].joinable) {
                        // console.log("debug__ : iterate games :", games[gameIds[i]]);
                        games[gameIds[i]].joinGame(user, socket);
                        thisGameId = games[gameIds[i]].gameId;
                        break;
                    }
                }
                if (i === gameCount) {
                    const gameId = + new Date();
                    games[gameId] = new Game(gameId);
                    games[gameId].joinGame(user, socket);
                    thisGameId = gameId;
                }
            // 일반 입장 요청 : from invitation ACCEPT btn.
            } else {
                if (games[data.gameId].joinable) {
                    games[data.gameId].joinGame(user,socket);
                    thisGameId = data.gameId;
                } else {
                    thisGameId = false;
                }
            }
            console.log("debug__ : joined games object :", games);
            done(thisGameId);
        });

        // request for generalPlayer
        // this event emit to ALLPlayer with this user's ready info
        // need client!
        socket.on("singleReady", (data) => {
            let user = userInfo[data.userId];
            games[data.gameId].readyGame(user, socket);
        });
        
        // request for start game from client, host!
        // need client!
        socket.on("startupRequest", (data, done) => {
            let game = games[data.gameId];

            if (game.host === data.userId) {
                game.startGame();
                done();
            }
        }); 

        // request from nowPlayer
        // this event emit to ALLPlayer with next turn info.
        // need client!
        socket.on("openTurn", (data) => {
            games[data.gameId].openTurn();
        });

        // request from lastPlayer in a cycle
        // this event emit to ALLPlayer with event result
        // need client!
        socket.on("nightEvent", (data) => {
            console.log(`nightEvent 전달`, data);
            let user = userInfo[data.userId];
            let submit = data.gamedata.submit; // 제출한 정보
            console.log(`nightEvent 전달`, user, submit);
            games[data.gameId].nightWork(user, submit);
        });

        // request from mafiaPlayer in the game
        // this event emit to ALLPlayer with new turn info.
        socket.on("newCycleRequest", (data) => {
            games[data.gameId].openNewCycle();
        });

        /*** for A Game : hyeRexx : end ***/

    });
}