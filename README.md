# MafiArte
### 마피아르떼는 제시어를 그림으로 그리면서 마피아를 찾는 게임입니다.
<br>
<img src="https://user-images.githubusercontent.com/96710052/183819911-275000f1-2cb7-4ea2-91ef-7435e6e93f23.png">
<br><br>

## 🛠 **아키텍처와 기술 스택**
**CLIENT**　 　React / Redux / WebRTC <br>
**SERVER**　　Node.js / NGiNX / socket.io <br>
**DB**　　　　 MySQL / RDS <br>
<br><br>

## 🎠 **몰입도 120% : 인게임 요소**
#### 🎥 **비디오 섹션**
지금 그리고 있는 유저를 살펴보고 의심가는 유저는 클릭해서 확대할 수 있습니다.

#### ⏱ **제시어 & 타이머**
제시어는 시민에게만 공개되고, 타이머는 게임 플로우를 관리합니다.

#### 🌈 **턴 알리미**
현재 턴이 끝나기 3초 전에 다음 턴 유저의 테두리가 깜빡거리며 순서를 알려 줍니다.

#### 😍 **이모지 채팅**
감정을 즉각적으로 표현할 수 있고, 죽은 유저의 표현 수단으로 활용할 수 있습니다.

#### 🎨 **캔버스**
자신의 순서가 되면 원하는 색을 골라 즐겁게 그릴 수 있습니다.

#### 📣 **채팅**
게임 대기 시간에도, 게임 중에도 채팅으로 소통할 수 있습니다.
<br><br><br>


## 🕹 **게임모드 : 게임별 이벤트 관리를 위한 객체**
* 게임 이벤트와 관련 데이터 관리를 위한 class입니다.
* 마피아르떼의 게임모드는 게임이 규칙에 따라 진행될 수 있도록 합니다.
```
class Game {
  constructor(gameId) {
        this.maxCnt = 8;
        this.gameId = gameId;
        this.socketAll = [];    // 게임 플레이어들의 소켓 정보 배열
        this.joinable = true;   // 게임 접근 가능 여부
        this.playerCnt = 0;     // 게임 플레이어 수 (max 파악용)
         .
         .
         .
        this.player = [];       // 게임에 접속한 유저 객체 원본
        this.turnQue = [];      // 게임 진행 순서 (queue)

        this.turnCnt = 0;       // 사이클 내의 턴 진행 상황
        this.cycleCnt = 0;      // 게임 반복 횟수
        this.nightDone = 0;     // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)

        this.voteRst = null;    // 시민 투표에서 선출된 사람
        this.guessRst = false;  // 마피아 정답 결과 (boolean)
  }
}
```
<br><br>

## 🤸‍♀️ 영상 레이턴시 개선 : 원활한 영상 통화
게임 접속 인원에 따라 해상도, 프레임레이트, 비트레이트를 유동적으로 조절해 데이터 전송량을 줄였습니다.
<br>
<p align="center">
<img src="https://user-images.githubusercontent.com/96710052/183824111-0f983085-23a0-4e9b-be34-2002292b1d2e.png" style="width: 800px;">
</p>
<br><br>

## ⛷ 캔버스 레이턴시 개선 : 시원하게 쭉- 그리기
코어 기능인 그림 그리기를 원활하게 할 수 있도록 데이터 전송량을 줄였습니다.
<br>
<p align="center">
  <img src="https://user-images.githubusercontent.com/96710052/183824113-ea3ab3e1-a706-443c-b52a-e4144bbddab7.png" style="width: 800px;">
</p>
