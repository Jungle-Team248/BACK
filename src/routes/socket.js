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
            // origin: ["https://admin.socket.io", "https://d2bxvfgokknit.cloudfront.net"], // 혜린
            origin: ["https://admin.socket.io", "https://marfiarte.click"], // 재관
            // origin: ["https://admin.socket.io", "https://d1cbkw060yb1pg.cloudfront.net"], // 해인
            credentials: true
        },
    });

    const connectedClient = {};
    
    instrument(ioServer, {auth: false});
    
    ioServer.on("connection", (socket) => {

        socket.on('userinfo', (id) => {
            const user = userInfo[id];
            user["socket"] = socket.id;
            socket["userId"] = id;
        });

        socket.on('loginoutAlert', (userId, status) => {
            (status === 0) && (delete userInfo[userId]);
            socket.broadcast.emit("friendList", userId, status);
        });

        socket.on('roomList', (done) => {
            const roomList = Object.keys(games).map((roomId) => {
                const game = games[roomId];
                return {host: game.host, playerCnt: game.playerCnt, joinable: game.joinable, gameId: game.gameId};
            });
            done(roomList);
        });

         // socket enterRoom event 이름 수정 확인 필요
        socket.on("enterRoom", (data, roomId, done) => {
            socket.room = roomId;
            socket.join(roomId);
            done(games[roomId].host);
            // 새로운 유저 입장 알림
            socket.to(roomId).emit("notifyNew", data);
        });

        socket.on("notifyOld", (data, toSocketId) => {
            data.isReady = userInfo[data.userId].ready;
            socket.to(toSocketId).emit("notifyOld", data);
        });

        socket.on("offer", async (offer, offersSocket, newbieSocket, offersId) => {
            socket.to(newbieSocket).emit("offer", offer, offersSocket, offersId);
        });
    
        socket.on("answer", (answer, offersSocket, newbieId) => {
            socket.to(offersSocket).emit("answer", answer, newbieId);
        });
    
        socket.on("ice", (ice, sendersId, othersSocket) => {
            socket.to(othersSocket).emit("ice", ice, sendersId);
        });
        
        socket.on("new_message", (msg, room, done) => {
            socket.to(room).emit("new_message", msg);
            done();
        });

        socket.on("emoji", (roomId, emoji) => {
            const data = {userId: socket.userId, emoji: emoji};
            socket.emit("newEmoji", data);
            socket.to(roomId).emit("newEmoji", data);
        })

        if (!(socket.id in connectedClient)) {
            connectedClient[socket.id] = {};
        } // client 관리용
        
        // need to modify : 게임 방에 들어가있으면 방 나가도록 조치 필요함
        socket.on("exit", (userId, roomId, done) => { 
            if (userInfo[userId]?.state === false) { // 서버를 껐다 킨 경우에는 game에 해당 roomId 자체가 없어서 괜찮. 서버는 그대로인데 터졌던 사람이 exit누르면 roomId가 있어서 거기서 나가려는 시도를 해서 터짐
                games[roomId]?.exitGame(userId);
                if (games[roomId]?.isEmpty()) {
                    delete games[roomId];
                }
                socket.leave(roomId);
                socket.room = null;
            }
            done();
        });

        socket.on("disconnecting", () => {
            console.log("someone disconnecting", socket.id);
        });
        
        socket.on('disconnect', () => {
            console.log(`Client disconnected (id: ${socket.id})`);

            const user = userInfo[socket.userId];
            socket.broadcast.emit("friendList", socket.userId, 0);
            if (user?.state === false) {
                const roomId = user.gameId;
                games[roomId].exitGame(user.userId);
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
        }); // client 관리용

        // 여러 명의 socketId 반환
        socket.on('listuserinfo', (listuserid, done) => {
            let listsocketid = new Array();
            for (var i = 0; i < listuserid.length; i++) {
                listsocketid.push(userInfo[listuserid[i]]["socket"]); // 에러 발생했음. 나중에 try로 묶어주든지 해야할 듯!
            }

            
            // 초대하고 싶은 사람 리스트 반환
            done(listsocketid);
        });

        // 초대 보내기
        socket.on("sendinvite",(listsocketid, roomId, myId, done) => {
            for (var i = 0; i < listsocketid.length; i++) {
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
            games[data.gameId] = new Game(data.gameId);
            games[data.gameId].joinGame(user, socket);
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
            let thisGameId;
            // 자동 입장 요청 : from START btn.
            if (data.gameId === 0) {
                const gameIds = Object.keys(games);
                const gameCount = gameIds.length;
                let i = 0;
                for (; i<gameCount; i++) {
                    if (games[gameIds[i]].joinable) {
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
                if (games[data.gameId]?.joinable) {
                    games[data.gameId].joinGame(user,socket);
                    thisGameId = data.gameId;
                } else {
                    thisGameId = false;
                }
            }
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
            let user = userInfo[data.userId];
            let submit = data.gamedata.submit; // 제출한 정보
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