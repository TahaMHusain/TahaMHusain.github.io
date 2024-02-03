// Adapted from https://github.com/arasgungore/Tic-Tac-Toe

import {joinRoom, selfId} from './trystero-torrent.min.js';
import {Player} from "./p2p-rooms.js";

const delay = ms => new Promise(res => setTimeout(res, ms));
const id2player = {0: "X", 1: "O"};

let gameActive = true;
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];

let playerID;
let awaitingPlayers = false;
let sendResultValidation;
let sendCellPlayed;
let sendRestartGame;
let statusDisplay;

let numPlayers = 1;

const container = document.getElementById("container");
const contentBottom = document.getElementById("content-bottom");


const winningMessage = () => `Player ${currentPlayer} has won!`;
const drawMessage = () => `Game ended in a draw!`;
const currentPlayerTurn = () => `It's ${currentPlayer}'s turn`;


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
    for(let i = 0; i <= 7; i++) {// Send updated master list to all peers
        room.makeAction("masterDict")[0](masterPeerDict);
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
        sendResultValidation("resultV");
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
        sendRestartGame("restartGame");
    }
}

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

async function waitingRoom(roomJoinQueryString, MIN_PLAYERS) {
    console.log("In waiting room...")
    const awaitPlayersMsg = document.createElement("span");
    awaitPlayersMsg.innerHTML = "<p>Joined room! Waiting for other players...</p> <br>";
    awaitPlayersMsg.id = "await-players-msg";
    const createRoomButton = document.getElementById("create-room-button");
    container.insertBefore(awaitPlayersMsg, createRoomButton);

    const roomLinkMsg = document.createElement("span");
    roomLinkMsg.innerHTML = "<p> Link to room: </p> <p>" + window.location.href + roomJoinQueryString + "</p>";
    roomLinkMsg.id = "room-link-msg";
    container.insertBefore(roomLinkMsg, createRoomButton);

    room.onPeerJoin(peerId => {
        if (Object.keys(room.getPeers()).length + 1 > MIN_PLAYERS) {
            startGame();
        }
    })


    awaitingPlayers = true;
    
}

function startup() {
    const queryString = window.location.search;
    if (queryString.length > 1) {
        const urlParams = new URLSearchParams(queryString);
        let player = new Player(
            config=config,
            roomCode=urlParams.get("roomCode"),
            hostId=urlParams.get("hostId"),
            MAX_PLAYERS=MAX_PLAYERS,
            MIN_PLYERS=MIN_PLAYERS
        );
    };
    
    const createRoomButton = document.createElement("span");
    createRoomButton.innerHTML = `
        <button className=startup id=create-room-button>Create Room</button>
    `
    const container = document.getElementById("container");
    container.appendChild(createRoomButton);
    // container.insertBefore(createRoomButton, contentBottom);
    createRoomButton.addEventListener('click', () => {
        const [isCreated, roomJoinQueryString] = createRoom(config);
        if (!isCreated) {
            //TODO: better error handling
            console.log("room not joined");
        } else {
            waitingRoom(roomJoinQueryString, MIN_PLAYERS);
        }
    });



    

}

function leaveGame() {
    room.leave();
    document.querySelectorAll('.game').forEach(e => e.remove());
    startup();
}

function startGame() {
    console.log("Starting game...")

    // Assign player order by alphabetical order of selfId
    let playerList = Object.keys(room.getPeers());
    playerList.push(selfId);
    playerList.sort();
    playerID = playerList.indexOf(selfId);

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

    [sendCellPlayed, getCellPlayed] = room.makeAction("cellPlayed");
    [sendResultValidation, getResultValidation] = room.makeAction("resultV");
    [sendRestartGame, getRestartGame] = room.makeAction("restartGame");

    getCellPlayed(handleCellPlayedPeer);
    getResultValidation(handleResultValidation);
    getRestartGame(handleRestartGame);
}