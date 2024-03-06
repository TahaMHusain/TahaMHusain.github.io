import {joinRoom, selfId} from './trystero-torrent.min.js';

let myArticles = [];
let otherArticles = [];
const container = document.getElementById("container");


startup();

async function checkRoom(roomCodeToTry) {
    console.log("Attempting to join room " + roomCodeToTry + "...")
    room = joinRoom(config, roomCodeToTry);

    const joiningRoomMsg = document.createElement("span");
    joiningRoomMsg.innerHTML = "<p>Joining room " + roomCodeToTry + "...</p>"
    joiningRoomMsg.id = "joining-room-msg";
    joiningRoomMsg.className = "game--status";
    container.appendChild(joiningRoomMsg);

    const createRoomButton = document.getElementById("create-room-button");
    container.insertBefore(joiningRoomMsg, createRoomButton);

    room.onPeerJoin(peerId => {
        console.log(`${peerId} joined`);
        numPlayers += 1;
        if (awaitingPlayers && numPlayers >= MIN_PLAYERS) {
            if (document.contains(document.getElementById("await-players-msg"))) {
                document.getElementById("await-players-msg").remove();
            };
            startGame();
        }
    });
    room.onPeerLeave(peerId => {
        console.log(`${peerId} left`);
        numPlayers -= 1;
    });
    // Ensure time for all connections by sleeping
    await delay(5000);
    joiningRoomMsg.remove();

    let peersList = Object.keys(room.getPeers());
    if (peersList.length + 1 > MAX_PLAYERS) {
        console.log("Room "+ roomCodeToTry +" full! Exiting");
        room.leave()
        return false;
    }

    console.log("Joined room " + roomCodeToTry);

    roomCode = roomCodeToTry;


    return true;
}

async function joinRoomFunc(roomCodeToTry) {
    console.log("In joinRoomFunc")
    let isJoined = await checkRoom(roomCodeToTry);
    
    if (isJoined) {
        if (document.contains(document.getElementById("room-full-msg"))) {
            document.getElementById("room-full-msg").remove();
        };
        if (numPlayers < MIN_PLAYERS) {
            const awaitPlayersMsg = document.createElement("span");
            awaitPlayersMsg.innerHTML = "<p>Joined room " + roomCodeToTry + "! Waiting for other players...</p>";
            awaitPlayersMsg.id = "await-players-msg";
            container.appendChild(awaitPlayersMsg);
            awaitingPlayers = true;
        } else {
            if (document.contains(document.getElementById("await-players-msg"))) {
                document.getElementById("await-players-msg").remove();
            };
            awaitingPlayers = false;
            startGame();
        } 
    } else {
        const roomFullMsg = document.createElement("span");
        roomFullMsg.innerHTML = "<p>Room " + roomCodeToTry + " is full! Try another code</p>"
        roomFullMsg.id = "room-full-msg";
        container.appendChild(roomFullMsg);

        const createRoomButton = document.getElementById("create-room-button");
        container.insertBefore(roomFullMsg, createRoomButton);
    }
}

async function createRoomFunc() {
    console.log("Creating room...")
    //Get random string for room code
    let roomCodeToTry = (Math.random() + 1).toString(36).substring(7)

    let isJoined = await checkRoom(roomCodeToTry);

    while (!isJoined) {
        console.log("Room " + roomCodeToTry + "didn't work...")
        roomCodeToTry = toString(parseInt(roomCodeToTry) + 1);
        room.onPeerLeave(peerId => {
            console.log(`${peerId} left`);
            
        });
        isJoined = await checkRoom(roomCodeToTry);
    }

    if (numPlayers < MIN_PLAYERS) {
        const awaitPlayersMsg = document.createElement("span");
        awaitPlayersMsg.innerHTML = "<p>Joined room " + roomCodeToTry + "! Waiting for other players...</p> <br>";
        awaitPlayersMsg.id = "await-players-msg";
        const createRoomButton = document.getElementById("create-room-button");
        container.insertBefore(awaitPlayersMsg, createRoomButton);

        const roomLinkMsg = document.createElement("span");
        roomLinkMsg.innerHTML = "<p> Link to room: </p> <p>" + window.location.href + "?roomCode=" + roomCodeToTry + "</p>";
        roomLinkMsg.id = "room-link-msg";
        container.insertBefore(roomLinkMsg, createRoomButton);


        awaitingPlayers = true;
    } else {
        startGame();
    }
    
}

function startup () {
    const joinButton = document.createElement("button");
    joinButton.className = "startup";
    joinButton.textContent = "Join Room";
    joinButton.id = "join-button";
    const spacer = document.createElement("br");
    spacer.className = "startup";
    const spacer2 = document.createElement("span");
    spacer2.className = "startup";
    spacer2.innerHTML = "<br><br><br>"
    const roomCodeInput = document.createElement("input");
    roomCodeInput.className = "startup";
    roomCodeInput.id = "room-code-input";
    roomCodeInput.textContent = "Room code";
    const createRoomButton = document.createElement("button");
    createRoomButton.className = "startup";
    createRoomButton.textContent = "Create Room";
    createRoomButton.id = "create-room-button"

    const container = document.getElementById("container");
    container.appendChild(joinButton);
    container.appendChild(spacer);
    container.appendChild(spacer2);
    container.appendChild(roomCodeInput);
    container.appendChild(createRoomButton);

    joinButton.addEventListener('click', () => joinRoomFunc(roomCodeInput.value));
    createRoomButton.addEventListener('click', createRoomFunc);

    container.insertBefore(createRoomButton, contentBottom);
    container.insertBefore(spacer2, contentBottom);
    container.insertBefore(roomCodeInput, contentBottom);
    container.insertBefore(spacer, contentBottom);
    container.insertBefore(joinButton, contentBottom);

    const queryString = window.location.search;
    console.log(queryString);
    if (queryString.length > 1) {
        const urlParams = new URLSearchParams(queryString);
        let roomCodeToTry = urlParams.get("roomCode");
        joinRoomFunc(roomCodeToTry);
    };
};

function addArticleTitle (title) {
    const [sendArticleTitle, getArticleTitle] = room.makeAction("title");
    sendArticleTitle(title);
    myArticles.push(title);

};

function addOtherArticleTitle (title) {
    otherArticles.push(title);
}

function judgeRound () {
    document.querySelectorAll('.game').forEach(e => e.remove());

    const [sendJudgeRound, getJudgeRound] = room.makeAction("judge");
    const random = Math.floor(Math.random() * otherArticles.length);
    const randArticleTitle = otherArticles[random];
    sendJudgeRound(randArticleTitle);

    const roundTitlePara = document.createElement("p");
    const roundTitleNode = document.createTextNode(randArticleTitle);
    roundTitlePara.appendChild(roundTitleNode);

    container.appendChild(roundTitlePara);

    const endRoundButton = document.createElement("button");
    endRoundButton.className = "game";
    endRoundButton.textContent = "End Round";

    container.appendChild(endRoundButton);
    endRoundButton.addEventListener("click", endRound);
};

function endRound () {
    const [sendEndRound, getEndRound] = room.makeAction("end");
    sendEndRound("end");
    startGame();
}

function bluffRound (randArticleTitle) {
    document.querySelectorAll('.startup').forEach(e => e.remove());
    document.querySelectorAll('.game').forEach(e => e.remove());

    let bluffStatusNode;
    if (myArticles.includes(randArticleTitle)) {
        const index = myArticles.indexOf(randArticleTitle);
        myArticles.splice(index, 1); // 2nd parameter means remove one item only
        const bluffStatusNode = document.createTextNode("This is your article!");
    } else {
        const index = otherArticles.indexOf(randArticleTitle);
        otherArticles.splice(index, 1);
        const bluffStatusNode = document.createTextNode("Don't cheat by looking it up, bluff!");
    };
    const bluffStatusPara = document.createElement("p");
    bluffStatusPara.className = "game"
    bluffStatusPara.appendChild(bluffStatusNode);
    container.appendChild(bluffStatusPara);

    const roundTitlePara = document.createElement("p");
    roundTitlePara.className = "game";
    const roundTitleNode = document.createTextNode(randArticleTitle);
    roundTitlePara.appendChild(roundTitleNode);
    container.appendChild(roundTitlePara);

    const [sendEndRound, getEndRound] = room.makeAction("end");
    getEndRound(startGame);
};

function startGame () {
    document.querySelectorAll('.game').forEach(e => e.remove());

    const [sendArticleTitle, getArticleTitle] = room.makeAction("title");
    getArticleTitle()
    const [sendJudgeRound, getJudgeRound] = room.makeAction("judge");
    getJudgeRound(bluffRound);


    const titleInput = document.createElement("input");
    titleInput.className = "game";
    titleInput.id = "title-input";
    titleInput.textContent = "Enter Wikipedia article title";

    container.appendChild(titleInput);
    titleInput.addEventListener("submit", addArticleTitle(titleInput.value));

    const judgeRoundButton = document.createElement("button");
    judgeRoundButton.className = "game";
    judgeRoundButton.id = "judge-round-button";
    judgeRoundButton.textContent = "Judge Round";

    container.appendChild(judgeRoundButton);
    judgeRoundButton.addEventListener("click", judgeRound);
};