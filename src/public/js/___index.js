const socket = io();

const call = document.getElementById("call");
const myFace = document.getElementById("myFace");
// const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
// const camerasSelect = document.getElementById("cameras");


let myStream;
let muted = false;
let cameraOff = false;

// ------------------ socket io ----------------------
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const nameform = welcome.querySelector("#name");
const roomNameInfo = welcome.querySelector("#roomname");
const container = document.getElementById("container");
const header = document.getElementById("header");
// 연결이 끊기면 계속해서 재시도 하는 모습을 볼 수 있음 (프론트 콘솔)
// handle Room Submit

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            // if(currentCamera.label === camera.label) cameras.value = camera.deviceId;
            // camerasSelect.append(option);
        })
    }
    catch(e) {
        console.log(e);
    }
}

async function getMedia(deviceId){
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: deviceId ? { deviceId } : true
        });
        myFace.srcObject = myStream;
        if(!deviceId) {
            getCameras();
        }
        // setMute(true);
    }
    catch(e) {
        alert(e);
    }
}

function handleMuteClick() {
    setMute(!muted);
}

function handleMuteCameraClick() {
    const cameraTracks = myStream.getVideoTracks();
    if(cameraOff) {
        cameraBtn.innerText = "Camera Off";
        cameraOff = false;
        cameraTracks.forEach(track => track.enabled = true);
    }
    else {
        cameraBtn.innerText = "Camera On";
        cameraOff = true;
        cameraTracks.forEach(track => track.enabled = false);
    }
}

async function handleCameraChange() {
    await getMedia(cameras.value);
    if(myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind === 'video');
        videoSender.replaceTrack(videoTrack);
    }
}

let peerConnections = {};

room.hidden = true;
// container.hidden = true;
header.hidden = false;

let roomName;

nameform.addEventListener("submit", handleNicknameSubmit);
roomNameInfo.addEventListener("submit", handleRoomName);

function addMessage(message) {
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

async function initCall() {
    await getMedia();
}

async function handleRoomName(event) {
    event.preventDefault();
    // js object를 보낼 수 있음 (msg 아님!), emit의 마지막 argument가 function일때 : back button어쩌구
    const input = welcome.querySelector("#roomname input");
    await initCall();
    socket.emit("enter_room", input.value, socket.id, showRoom); 
    roomName = input.value;
    input.value = "";
}


function handleMessageSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    socket.emit("new_message", value, roomName, () => {
        addMessage(`You : ${value}`);
    });
    input.value = ""; // aSync
}

function handleNicknameSubmit(event) {
    event.preventDefault();
    const input = welcome.querySelector("#name input");
    const value = input.value;
    socket.emit("nickname", value);
    input.value = ""; // aSync
}

function showRoom() {
    welcome.hidden = true;
    room.hidden = false;
    header.hidden = true;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("id", "myCanvas");
    canvas.setAttribute("style", 'background: #ddd;');
    container.appendChild(canvas);
    const whiteboard = new Whiteboard(canvas, socket, roomName);

    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    
    const msgform = room.querySelector("#msg");
    msgform.addEventListener("submit", handleMessageSubmit);

}

room.addEventListener("submit", (event) => {
    event.preventDefault();
})

socket.on("welcome", async(user, newCount, newbieID) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    const offer = await makeConnection(newbieID);
    socket.emit("offer", offer, roomName, newbieID, socket.id);
    addMessage(`${user} arrived!`);
});

socket.on("offer", async(offer, offersId) => {
    // 뉴비는 현재 방안에 있던 모든사람의 offer를 받아 새로운 커넥션을 만들고, 답장을 만든다.
    const answer = await makeConnection(offersId, offer);
    // 답장을 현재 있는 받은 커넥션들에게 각각 보내준다.
    socket.emit("answer", answer, offersId, socket.id);
});

socket.on("answer", async(answer, newbieID) => {
    // 방에 있던 사람들은 뉴비를 위해 생성한 커섹션에 answer를 추가한다.
    peerConnections[newbieID].setRemoteDescription(answer);
});

socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${left} just left T.T`);
});

socket.on("new_message", addMessage);

socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    if (rooms.length === 0) {
        return;
    }
    rooms.forEach((room) => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});

async function makeConnection(othersId, _offer) {
    const myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                    "stun:stun01.sipphone.com",
                    "stun:stun.ekiga.net",
                    "stun:stun.fwdnet.net",
                    "stun:stun.ideasip.com",
                    "stun:stun.iptel.org",
                    "stun:stun.rixtelecom.se",
                    "stun:stun.schlund.de",
                    "stun:stunserver.org",
                    "stun:stun.softjoys.com",
                    "stun:stun.voiparound.com",
                    "stun:stun.voipbuster.com",
                    "stun:stun.voipstunt.com",
                    "stun:stun.voxgratia.org",
                    "stun:stun.xten.com"
                ]
            }
        ]
    });
    peerConnections[othersId] = myPeerConnection;

    myPeerConnection.addEventListener("icecandidate", (data) => handleIce(data, othersId));
    myPeerConnection.addEventListener("addstream", (data) => handleAddStream(data, othersId));
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));

    let offer = _offer;
    let answer;
    if(!offer) {
        offer = await myPeerConnection.createOffer();
        myPeerConnection.setLocalDescription(offer);
    }
    else {
        myPeerConnection.setRemoteDescription(offer);
        answer = await myPeerConnection.createAnswer();
        myPeerConnection.setLocalDescription(answer);
    }

    return answer || offer;
}

function handleIce(data, othersId) {
    // ice breack가 생기면? 이를 해당 사람들에게 전달한다.
    socket.emit("ice", data.candidate, roomName, othersId, socket.id);
}

function handleAddStream(data, othersId) {
    // stream을 받아오면, 비디오를 새로 생성하고 넣어준다.
    let video = document.createElement("video");
    document.getElementById("othersStream").appendChild(video);
    video.id = othersId;
    video.autoplay = true;
    video.playsInline = true;
    video.style.backgroundColor = "blue";
    video.width = 400;
    video.height = 250;
    video.srcObject = data.stream;
}

socket.on("ice", (ice, othersId) => {
    console.log("receive candidate");
    /** 다른 사람에게서 받은 ice candidate를 각 커넥션에 넣는다. */
    peerConnections[othersId].addIceCandidate(ice);
});

cameraBtn.addEventListener("click", handleMuteCameraClick);