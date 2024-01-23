import {joinRoom, selfId} from './trystero-torrent.min.js';

const delay = ms => new Promise(res => setTimeout(res, ms));
const id2player = {1: "X", 2: "O"};

let gameActive = true;
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];


let room;
let roomCode;
let playerID;
let awaitingPlayers = false;
let sendResultValidation;
let sendCellPlayed;
let sendRestartGame;
let statusDisplay;

let numPlayers = 1;

const container = document.getElementById("container");
const contentBottom = document.getElementById("content-bottom");

const MAX_PLAYERS = 2;
const MIN_PLAYERS = 2;
const winningMessage = () => `Player ${currentPlayer} has won!`;
const drawMessage = () => `Game ended in a draw!`;
const currentPlayerTurn = () => `It's ${currentPlayer}'s turn`;
const config = {appId: 'taha-tictactoetest'};

startup();

const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

function handleCellPlayed(clickedCell, clickedCellIndex) {
    gameState[clickedCellIndex] = currentPlayer;
    clickedCell.innerHTML = currentPlayer;
}

function handleCellPlayedPeer(clickedCellIndex) {
    let clickedCell = document.querySelector('[data-cell-index="' + clickedCellIndex + '"]')
    handleCellPlayed(clickedCell, clickedCellIndex);
}

function handlePlayerChange() {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusDisplay.innerHTML = currentPlayerTurn();
}



function handleResultValidation() {
    let roundWon = false;
    for(let i = 0; i <= 7; i++) {
        const winCondition = winningConditions[i];
        const a = gameState[winCondition[0]];
        const b = gameState[winCondition[1]];
        const c = gameState[winCondition[2]];
        if(a === '' || b === '' || c === '')
            continue;
        if(a === b && b === c) {
            roundWon = true;
            break
        }
    }

    if(roundWon) {
        statusDisplay.innerHTML = winningMessage();
        gameActive = false;
        return;
    }

    const roundDraw = !gameState.includes("");
    if(roundDraw) {
        statusDisplay.innerHTML = drawMessage();
        gameActive = false;
        return;
    }

    handlePlayerChange();
}

function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));

    if(gameState[clickedCellIndex] !== "" || currentPlayer !== id2player[playerID] || !gameActive)
        return;

    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
    if (numPlayers > 1) {
        sendCellPlayed(clickedCellIndex);
        sendResultValidation({dummy: "dummy"});
    }
    
}

function handleRestartGame() {
    gameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    statusDisplay.innerHTML = currentPlayerTurn();
    document.querySelectorAll('.cell').forEach(cell => cell.innerHTML = "");
}

function handleRestartClick() {
    handleRestartGame();
    if (numPlayers > 1) {
        sendRestartGame({dummy: "dummy"});
    }
}

async function checkRoom(roomCodeToTry) {
    console.log("Attempting to join room " + roomCodeToTry + "...")
    room = joinRoom(config, roomCodeToTry);

    const joiningRoomMsg = document.createElement("span");
    joiningRoomMsg.innerHTML = "<p>Joining room " + roomCodeToTry + "...</p>"
    joiningRoomMsg.id = "joining-room-msg";
    container.appendChild(joiningRoomMsg);

    const roomCodeInput = document.getElementById("room-code-input");
    container.insertBefore(joiningRoomMsg, roomCodeInput);

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

async function joinRoomFunc(roomCodeEl) {
    console.log("In joinRoomFunc")
    let roomCodeToTry = roomCodeEl.value;

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

        const roomCodeInput = document.getElementById("room-code-input");
        container.insertBefore(roomFullMsg, roomCodeInput);
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
        isJoined = await checkRoom(roomCodeToTry);
    }

    if (numPlayers < MIN_PLAYERS) {
        const awaitPlayersMsg = document.createElement("span");
        awaitPlayersMsg.innerHTML = "<p>Joined room " + roomCodeToTry + "! Waiting for other players...</p>";
        awaitPlayersMsg.id = "await-players-msg";
        const roomCodeInput = document.getElementById("room-code-input");
        container.insertBefore(awaitPlayersMsg, roomCodeInput);

        awaitingPlayers = true;
    } else {
        startGame();
    }
    
}

function startup() {
    const joinButton = document.createElement("button");
    joinButton.className = "startup";
    joinButton.textContent = "Join Room";
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

    const container = document.getElementById("container");
    container.appendChild(joinButton);
    container.appendChild(spacer);
    container.appendChild(spacer2);
    container.appendChild(roomCodeInput);
    container.appendChild(createRoomButton);

    joinButton.addEventListener('click', () => joinRoomFunc(roomCodeInput));
    createRoomButton.addEventListener('click', createRoomFunc);

    container.insertBefore(roomCodeInput, contentBottom);
    container.insertBefore(spacer, contentBottom);
    container.insertBefore(joinButton, contentBottom);
    container.insertBefore(spacer2, contentBottom);
    container.insertBefore(createRoomButton, contentBottom);

    

}

function leaveGame() {
    room.leave();
    document.querySelectorAll('.game').forEach(e => e.remove());
    startup();
}

function startGame() {
    console.log("Starting game...")

    let playerList = Object.keys(room.getPeers());
    sortedPlayers = playerList.sort();
    playerID = sortedPlayers.indexOf(selfId);

    document.querySelectorAll('.startup').forEach(e => e.remove());

    const roomCodeText = document.createTextNode("Room code: " + roomCode);
    roomCodeText.className = "game";
    container.appendChild(roomCodeText);
    container.insertBefore(roomCodeText, contentBottom);

    const roomCodeHeader = document.createElement("span");
    roomCodeHeader.innerHTML = `
    <br>
    <button id="leave-room">Leave Room</button>
    <br>
    <br>
    `
    roomCodeHeader.className = "game";
    container.appendChild(roomCodeHeader);
    container.insertBefore(roomCodeHeader, contentBottom);

    const gameHTML = document.createElement("span");
    gameHTML.innerHTML = `
    <section>
        <h2 id="this-player-msg" class="game--status"></h2>
        <div class="game--container">
            <div data-cell-index="0" class="cell"></div>
            <div data-cell-index="1" class="cell"></div>
            <div data-cell-index="2" class="cell"></div>
            <div data-cell-index="3" class="cell"></div>
            <div data-cell-index="4" class="cell"></div>
            <div data-cell-index="5" class="cell"></div>
            <div data-cell-index="6" class="cell"></div>
            <div data-cell-index="7" class="cell"></div>
            <div data-cell-index="8" class="cell"></div>
        </div>
        <h2 id="current-player-msg" class="game--status"></h2>
        <button class="game--restart">Restart Game</button>
    </section>
    `
    gameHTML.className = "game";
    container.appendChild(gameHTML);
    container.insertBefore(gameHTML, contentBottom);

    const leaveRoomButton = document.getElementById("leave-room");
    leaveRoomButton.addEventListener('click', leaveGame);

    document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', handleCellClick));
    document.querySelector('.game--restart').addEventListener('click', handleRestartClick);

    let thisPlayer = document.getElementById("this-player-msg");
    thisPlayer.innerHTML = "You're playing as " + id2player[playerID];

    statusDisplay = document.getElementById("current-player-msg");
    statusDisplay.innerHTML = currentPlayerTurn();

    let getCellPlayed;
    let getResultValidation;
    let getRestartGame;

    [sendCellPlayed, getCellPlayed] = room.makeAction('cellPlayed');
    [sendResultValidation, getResultValidation] = room.makeAction('resultV');
    [sendRestartGame, getRestartGame] = room.makeAction('restartGame');

    getCellPlayed(handleCellPlayedPeer);
    getResultValidation(handleResultValidation);
    getRestartGame(handleRestartGame);
}