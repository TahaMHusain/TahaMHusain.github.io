import {joinRoom} from './trystero-torrent.min.js';

let gameActive = true;
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];

let room;
let sendResultValidation;
let sendCellPlayed;
let sendRestartGame;
let statusDisplay;

let numPlayers = 1;

const container = document.getElementById("container");
const contentBottom = document.getElementById("content-bottom");

const MAX_PLAYERS = 2;
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

    if(gameState[clickedCellIndex] !== "" || !gameActive)
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

function checkRoom(roomCode) {
    console.log("Attempting to join room " + roomCode + "...")
    room = joinRoom(config, roomCode);
    let peerList = room.getPeers();

    if (peerList.size > MAX_PLAYERS - 1) {
        console.log("Room "+ roomCode +" full! Exiting");
        room.leave()
        return false;
    }

    room.onPeerJoin(peerId => {
        console.log(`${peerId} joined`);
        numPlayers += 1;
    });
    room.onPeerLeave(peerId => {
        console.log(`${peerId} left`);
        numPlayers -= 1;
    });
    return true;
}

function joinRoomFunc(roomCodeEl) {
    console.log("In joinRoomFunc")
    let roomCode = roomCodeEl.value;
    
    if (checkRoom(roomCode)) {
        if (document.contains(document.getElementById("room-full-mssg"))) {
            document.getElementById("room-full-mssg").remove();
        };
        startGame(); 
    } else {
        const roomFullMssg = document.createTextNode("Room " + roomCode + " is full! Try another code");
        roomFullMssg.id = "room-full-mssg";
        const container = document.getElementById("container");
        container.appendChild(roomFullMssg);
        document.body.insertBefore(roomFullMssg, container);
    }
}

function createRoomFunc() {
    console.log("Creating room...")
    //Get random string for room code
    let roomCode = (Math.random() + 1).toString(36).substring(7)

    while (!(checkRoom(roomCode))) {
        console.log("Room " + roomCode + "didn't work...")
        roomCode = toString(parseInt(roomCode) + 1);
    }

    startGame();
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

function startGame() {
    console.log("Starting game...")
    document.querySelectorAll('.startup').forEach(e => e.remove());

    const gameHTML = document.createElement("span");
    gameHTML.innerHTML = `
    <section>
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
        <h2 class="game--status"></h2>
        <button class="game--restart">Restart Game</button>
    </section>
    `
    container.appendChild(gameHTML);
    container.insertBefore(gameHTML, contentBottom);

    document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', handleCellClick));
    document.querySelector('.game--restart').addEventListener('click', handleRestartClick);

    statusDisplay = document.querySelector('.game--status');
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