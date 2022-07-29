import {userInfo} from '../server.js'
import {ASSERT} from './debug';
const dbpool = require('./db');

export default class Game {
    // 게임 생성
    constructor(gameId) {
        this.maxCnt = 8;
        this.gameId = gameId;
        this.socketAll = [];    // 게임 플레이어들의 소켓 정보 배열
        this.joinable = true;   // 게임 접근 가능 여부
        this.playerCnt = 0;     // 게임 플레이어 수 (max 파악용)
        this.started = false;
        
        this.host = null;       // 게임을 생성한 사람 또는 첫 번째 유저
        this.mafia = null;      // 게임의 마피아 (매 게임 갱신)
        this.word = null;       // 게임 제시어 : db완료후 로직 구현 : 난수로 wordid 추출
        this.rip = [];          // 사망으로 등록된 사람

        this.player = [];       // 게임에 접속한 유저 객체 원본
        this.turnQue = [];      // 게임 진행 순서 (queue)

        this.turnCnt = 0;       // 사이클 내의 턴 진행 상황
        this.cycleCnt = 0;      // 게임 반복 횟수
        this.nightDone = 0;     // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)

        this.voteRst = null;    // 시민 투표에서 선출된 사람
        this.guessRst = false;   // 마피아 정답 결과 (boolean)
    }

    // 방 전체에 이벤트 전송
    emitAll(msg, data) {
        this.socketAll.forEach(socket => {
            console.log("emit to : ", socket.userId);
            socket.emit(msg, data);
        });
    }

    // 게임 host 세팅 : player Arr의 첫 번째 유저 (입장 순서 정렬)
    setHost() {
        this.host = this.player[0].userId;
    }

    isEmpty() {
        return (this.playerCnt === 0);
    }

    // 게임 입장 : user object에 추가 속성 부여 및 각 array에 push
    joinGame(user, socket) {    
        console.log(user);
        for (let i = 0; i < this.player.length; i++) {
            if ( user.userId === this.player[i].userId ) {
                return null;
            }
        }
        user.gameId = this.gameId;
        user.state = false;        // 게임 in, user state 변경
        user['ready'] = false;     // 인게임용 추가 속성 : 레디 정보
        user['mafia'] = false;     // 인게임용 추가 속성 : 마피아 정보
        user['servived'] = true;   // 인게임용 추가 속성 : 살았니 죽었니
        user['votes'] = 0;         // 인게임용 추가 속성 : 득표 수 : 밤이되었습니다   

        this.player.push(user);
        this.socketAll.push(socket);

        this.playerCnt++;
        this.joinable = (this.playerCnt >= this.maxCnt) ? false : true; // 게임 접근 차단
        this.playerCnt == 1 ? this.setHost() : null; // 호스트 뽑기
        (this.host === user.userId) && this.turnQue.push(user.userId) && (user.ready = true);
    }


    // 게임 레디 : 호스트가 아닌 일반 유저만 작동 가능
    // ready - cancle ready 한 번에 작동 (조건 분기 있음)
    // ready 버튼에 onclick으로 game.readyGame, event 유저의 userId 전달
    readyGame(user, socket) {
        this.socketAll.forEach(socket => console.log(socket.Id));
        if (!user.ready) {
            this.turnQue.push(user.userId);
            user.ready = true;
        } else {
            this.turnQue.splice(this.turnQue.findIndex(x => x === user.userId), 1);
            user.ready = false;
        }

        // 인원 조건 충족 + 마지막 ready 처리 되었을 때 readyToStart로 전달
        // add it : this.playerCnt > 3 && 
        // 받아서 start button 활성화 가능
        // host에게만 start 가능 event 보냄
        // 이후 위 add it 조건 (4명 이상일 때에만 start가능) 추가 필요함
        // this.emitAll("readyToStart", {readyToStart: (this.turnQue.length === this.playerCnt)});
        const hostSocket = userInfo[this.host].socket;
        // console.log(`${user.userId} ready!`);
        // console.log(this.turnQue.length === this.playerCnt);
        socket.to(hostSocket).emit("readyToStart", {readyToStart: (this.turnQue.length === this.playerCnt)});

        // 다른 유저들에게 ready 알림
        this.emitAll("notifyReady", {userId : user.userId, isReady: user.ready})
    }

    // 게임 턴 세팅 : 턴 큐로 셔플
    // 4인인 경우 셔플이 잘 안되어서 부득이하게 두 번 돌림. 지우지 말아주세염..
    setGameTurn() {
        this.turnQue = this.turnQue.sort(() => Math.random() - 0.729);
        this.turnQue = this.turnQue.sort(() => Math.random() - 0.481);
    }

    // 마피아 뽑기
    drawMafia() {
        this.mafia = this.turnQue[0];
        // this.mafia = this.turnQue[Math.floor(Math.random() * this.turnQue.length)]
        console.log("debug1::::::", this.player);
        // console.log("debug::::::", this.player.findIndex(x => x.userId === this.mafia));
        // console.log("debug::::::", this.player[0].mafia);
        // console.log(this.player[this.player.findIndex(x => x.userId === this.mafia)]);
        this.player[this.player.findIndex(x => x.userId === this.mafia)].mafia = true;
        console.log("debug2::::::", this.player);
    }

    // DB에서 카테고리-단어 선택 -> 임시 샘플 데이터 입력
    async setWord() {
        // sample data
        // const categories = ['요리', '과일', '동물'];
        // const words = {요리: ['라면', '미역국', '카레'], 과일: ['사과', '바나나'], 동물: ['코알라', '용', '펭귄']};
        // const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
        // const selectedWord = words[selectedCategory][Math.floor(Math.random() * words[selectedCategory].length)];
        const [categoriesDB] = await dbpool.query('SELECT DISTINCT category FROM GAMEWORD');
        const categories = categoriesDB.map(obj => obj.category);
        const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
        const [wordsDB] = await dbpool.query('SELECT word FROM GAMEWORD WHERE category=?', selectedCategory);
        const words = wordsDB.map(obj => obj.word);
        const selectedWord = words[Math.floor(Math.random() * words.length)];
        this.word = selectedWord;
        return [selectedCategory, selectedWord];
    }

    // 게임 시작 : 조건 : readyCnt = n - 1, player > 3
    startGame() {
        this.joinable = false;
        this.started = true;
        this.cycle = 0; // 초기화

        this.emitAll("waitStart", null);

        // webRTC 연결을 위해 streamStart event 발생시킴
        for (let from=0; from<this.socketAll.length-1; from++) {
            for (let to=from+1; to<this.socketAll.length; to++) {
                this.socketAll[from].to(this.socketAll[to].id).emit("streamStart", this.player[from].userId, this.socketAll[from].id);
            }
        }

        // webRTC 연결이 시간이 걸릴 것으로 예상되므로 5초 대기했다가 후속 진행함
        setTimeout(async ()=>{
            this.setGameTurn();
            this.drawMafia();
            const [category, word] = await this.setWord();
    
            // webRTC 연결이 완료되면 턴, 마피아 정하고나서 game start event 발생시킴
            // 턴과 역할 보여주는 시간 5초 주고 이후 턴 진행함
            for (let i=0; i<this.socketAll.length; i++) {
                console.log('현재 시민', this.player[i].userId,'마피아', this.mafia);
                if (this.player[i].userId !== this.mafia) {
                    console.log('시민이 제시어 받음');
                    this.socketAll[i].emit("gameStarted", {turnInfo : this.turnQue, word:  {category, word}});
                } else {
                    console.log('마피아가 제시어 받음');
                    this.socketAll[i].emit("gameStarted", {turnInfo : this.turnQue, word:  {category, word: "?"}});
                }
            }
            setTimeout(()=>{
                this.openTurn(); // 첫 턴 뽑기
            }, 9000);
        }, 5000);
    }

    // 인게임 턴 교체 : 끝난 플레이어, 다음 플레이어 리턴 (socket.on("singleTurnChange"))
    openTurn() {
        // 사이클 끝났는지 확인하고 notification + 사이클 끝나면 턴 제공하지 않음
        if (this.turnCnt === this.playerCnt - this.rip.length) {
            console.log('턴이 끝났습니다.');
            this.emitAll("cycleClosed", this.rip);
            return;
        }
        
        let Players = [];
        let nowPlayer = this.turnQue.shift(); // 리턴해 줄 유저! 지금 그릴 사람!
        this.turnQue.push(nowPlayer); // 뽑고 바로 뒤로 밀어넣기
        Players.push(nowPlayer);

        // 만일 현재 턴이 마지막 턴일 경우 현재 턴과 다음 턴은 null 값을 보냄
        this.turnCnt === this.playerCnt - this.rip.length - 1 ? Players.push(null) : Players.push(this.turnQue[0]);

        let isMafia = (nowPlayer === this.mafia) ? true : false; // 마피아인지 확인
        console.log('이번 턴의 마피아', this.mafia);
        console.log('현재 플레이어', nowPlayer);

        this.turnCnt++;

        const data = { userId : Players, isMafia : isMafia };
        console.log('이번 턴에 대한 정보', data);
        this.emitAll("singleTurnInfo", data)
    }

    // 인게임 : 밤이되었습니다 : 시민 - 투표 / 마피아 - 제시어 맞추기
    nightWork(user, submit) {
        // user: 해당 user의 userInfo -> user.userId: userId
        // submit: 제출한 정보
        if (!this.started) {
            return null;
        }

        this.nightDone++;  // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)
        
        if (user.userId === this.mafia) {
            console.log(`마피아 정답 제출 ${user.userId} ${submit}`);
            this.guessForMafia(submit); // 마피아 추측
        } else {
            console.log(`시민 정답 제출 ${user.userId} ${submit}`);
            this.voteForCitizen(submit); // 시민 투표 
        }

        //console.log('플레이어 전원 투표 완료 됐나?', this.nightDone, this.playerCnt);
        // 플레이어 전원이 투표 완료한 경우
        console.log('nightDone turnQue length', this.nightDone, this.turnQue.length);
        if ( this.nightDone >= this.turnQue.length ) { // 수정 :: 턴큐에 있는 사람 수
            
            let nightData = {
                win : null,
                elected : null,
                voteData : {},
            }

            // 분기 : 마피아 정답 맞춤 - 시민들이 마피아에 투표 + 마피아는 틀림 - else
            if (this.guessRst) { 
                nightData.win = 'mafia';
            } else if (this.voteRst === this.mafia && !this.guessRst) {
                nightData.win = 'citizen';
            } else if (this.voteRst){ // 시민이 만장일치로 잘못된 시민 선출 시
                nightData.elected = this.voteRst;
                this.rip.push(this.voteRst);
                let userIdx = this.player.findIndex(x => x.userId === this.voteRst);
                this.player[userIdx].servived = false; // 죽은 사람 정보 변경
                
            } else if (this.turnQue.length <= 2) {
                nightData.win = 'mafia';
            }

            this.player.forEach(user => {
                if (!this.rip.includes(this.player)) {
                    console.log('하이',user, user.userId, user.votes);
                    nightData.voteData[user.userId] = user.votes;
                }
            });

            // night result 초기화 
            this.guessRst = false;
            this.voteRst = null;

            this.emitAll("nightResult", nightData);
            this.nightDone = 0;
            
            if (nightData['win'] === null) {
                setTimeout(()=>{ 
                    this.openNewCycle(); // 새로운 사이클 시작
                }, 12000);
            } else {
                this.closeGame();
            };
        }
    }

    // 투표 : 시민만 : 만장일치 나올 경우만 voteRst 등록
    // 투표 조건에 맞을 경우 우선 rip[0]으로 추가
    // mafia or not으로 조건 분기해서 front로 emit userid
    voteForCitizen(user) {
        console.log('이번에 뽑은 사람은?', user);
        let gameuser;
        if (user){
            console.log('이번에 뽑은 사람', user);
            let userIdx = this.player.findIndex(x => x.userId === user);
            gameuser = this.player[userIdx];
            gameuser.votes++; // 득표 수++
            
            // 투표 수 충족시 : 사망 또는 체포 분기
            if (gameuser.votes == this.playerCnt - this.rip.length - 1) {
                console.log('사망 분기', gameuser.userId);
                this.voteRst = gameuser.userId;
                console.log('시민 아직 살아있나', this.turnQue);
                let dieId = this.turnQue.findIndex(x => x === user);
                this.turnQue.splice(dieId, 1); // 죽은 시민 turnQueue에서 삭제
                console.log('시민 잘 죽었나', this.turnQue);
            }
        }
    }

    // 제시어 추측 : 마피아만 : success or not으로 조건분기해서 front로 emit
    guessForMafia(word) {
        if (word === this.word) {
            this.guessRst = true;
        }
    }

    // 새로운 턴 시작
    openNewCycle() {
        this.turnCnt = 0;   // 초기화
        this.cycleCnt++;    // cycle 정보 업데이트 : 추후 마피아 힌트 등 준비
        // voteCnt 리셋
        this.player.forEach(user => {
            user.votes = 0;
        });
        this.openTurn();    // 새로운 턴 정보 제공
    }

    // 게임 종료 : 정상 종료
    closeGame() {
        console.log("Game Closed");

        // User's values 초기화
        this.player.forEach(user => {
            user.ready = false; // need to modify : 게임 종료시 더 초기화해야할 데이터는 없나? this.joinable을 바꿔줘야할 것 같음. 경우에 따라 true or false
            user.mafia = false;
            user.servived = true;
            user.votes = 0;
        });

        // Game instance 초기화
        this.mafia = null;      // 게임의 마피아 (매 게임 갱신)
        this.word = null;       // 게임 제시어 : db완료후 로직 구현 : 난수로 wordid 추출
        this.rip = [];          // 사망으로 등록된 사람
        this.turnQue = [];      // 게임 진행 순서 (queue)
        this.turnCnt = 0;       // 사이클 내의 턴 진행 상황
        this.cycleCnt = 0;      // 게임 반복 횟수
        this.nightDone = 0;     // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)
        this.voteRst = null;    // 시민 투표에서 선출된 사람
        this.guessRst = false;   // 마피아 정답 결과 (boolean)

        // count에 따라 joinable 초기화
        this.joinable = (this.playerCnt === this.maxCnt) ? false : true; // 게임 접근 차단
        this.turnQue.push(this.player[0]?.userId) && (this.player[0].ready = true);
        this.started = false;
    }

    // 게임 나가기 : 이벤트 유저의 userId 전달
    // need to modify : 게임 시작 전 나가는경우와 게임 중 나가는 경우를 나눠야 할 듯 
    // (게임 시작 전 나가는 경우에, 꽉 차있다가 자리가 난 경우라면 joinable을 true로 바꿔줘야 할 수 있음)
    
    exitGame(userId) { 
        let userIdx = this.player.findIndex(x => x.userId === userId); 
        let exitUser = this.player[userIdx];
        let turnIdx = this.turnQue.findIndex(x => x === userId); 
        let socketIdx = this.socketAll.findIndex(x => x.userId === userId);
        
        const [socket] = this.socketAll.splice(socketIdx, 1);
        console.log(`exiter Id : ${userId}, deleted socket.userId : ${socket.userId}`);
        this.player.splice(userIdx, 1);
        this.playerCnt--;

        this.emitAll("someoneExit", userId);
        
        // 나가는 사람이 호스트일 경우 호스트 뽑기
        if (this.playerCnt > 0 && exitUser.userId === this.host) {
            this.setHost();
            if (!this.player[0].ready) {
                this.player[0].ready = true;
                this.turnQue.push(this.host);
            }
            // 호스트 바뀜. 방 내 유저에게 전달 필요. 클라이언트에서 isHost set 필요
            socket.to(userInfo[this.host].socket).emit("hostChange", this.host);
        }
        
        if (!this.started){
            console.log("게임 시작 전")
            exitUser.ready && this.turnQue.splice(turnIdx, 1);
            if (this.playerCnt > 0) {
                socket.to(userInfo[this.host].socket).emit("readyToStart", {readyToStart: ((this.turnQue.length === this.playerCnt) && (this.playerCnt > 1))});
            }
        } else {
            console.log("게임 시작 후");
            
            let nightData = {
                win : null
            }
            
            if (this.mafia == userId) {
                console.log("mafia 나감; 바로 시민 승리 게임 close 해야함.");
                nightData.win = "citizen";
                this.emitAll("abnormalClose", nightData);
                this.closeGame();
            } else if (this.turnQue.length <= 2) {
                console.log("citizen 나감; 바로 마피아 승리 게임 close 필요");
                nightData.win = "mafia";
                this.emitAll("abnormalClose", nightData);
                this.closeGame();
            } else {
                // 나간 사람이 게임 중에 죽었는지 살았는지 여부
                if (!exitUser.servived){
                    let ripIdx = this.rip.findIndex(x => x === userId);
                    this.rip.splice(ripIdx);
                } else {
                    this.turnQue.splice(turnIdx);
                }
            }
        }

        exitUser.gameId = null;
        exitUser.state = true;
        delete exitUser.ready;
        delete exitUser.mafia;
        delete exitUser.servived;
        delete exitUser.votes;
    }
}

// const user1 = { userId : '재관', socket : '1111user' };
// const user2 = { userId : '해인', socket : '2222user' };
// const user3 = { userId : '혜린', socket : '3333user' };
// const user4 = { userId : '진호', socket : '4444user' };
// const user5 = { userId : 'user5', socket : '5555user' };
// const user6 = { userId : 'user6', socket : '6666user' };
// const user7 = { userId : 'user7', socket : '7777user' };
// const user8 = { userId : 'user8', socket : '8888user' };

// let game = new Game(Date.now());

// console.log("\n\n----------------- new game! ------------------\n");

// game.joinGame(user1);
// game.joinGame(user2);
// game.joinGame(user3);
// game.joinGame(user4);

// game.player.map(user => {game.readyGame(user.userId)})

// // let now = game.startGame().playerNow.userId;
// // let next= game.startGame().playerNext.userId;
// console.log(game.startGame())
// console.log("host :", game.host, "\nmafia :", game.mafia)
// console.log("turn :", game.turnQue)

// console.log(game.changePlayer());
// console.log(game.changePlayer());
// console.log(game.changePlayer());
// console.log(game.changePlayer());




