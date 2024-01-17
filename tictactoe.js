import {joinRoom} from './trystero-torrent.min.js';

let gameActive = true;
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];

let room;
let sendResultValidation;
let sendCellPlayed;
let sendRestartGame;

let numPlayers = 1;

const statusDisplay = document.querySelector('.game--status');

const winningMessage = () => `Player ${currentPlayer} has won!`;
const drawMessage = () => `Game ended in a draw!`;
const currentPlayerTurn = () => `It's ${currentPlayer}'s turn`;
const config = {appId: 'taha-tictactoetest'};

startup();

statusDisplay.innerHTML = currentPlayerTurn();

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

function handleCellPlayedPeer(a) {
    handleCellPlayed(a[0], a[1]);
    console.log("Before change:" + a[0].innerHTML);
    a[0].innerHTML = currentPlayer;
    console.log("After change:" + a[0].innerHTML);
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
        console.log("Room found!");
        sendCellPlayed([clickedCell, clickedCellIndex]);
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
        console.log("Room found!");
        sendRestartGame({dummy: "dummy"});
    }
}



document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', handleCellClick));
document.querySelector('.game--restart').addEventListener('click', handleRestartClick);

function startup() {
    let getCellPlayed;
    let getResultValidation;
    let getRestartGame;
    
    room = joinRoom(config, 'yoyodyne');

    room.onPeerJoin(peerId => {
        console.log(`${peerId} joined`);
        numPlayers += 1;
    });
    room.onPeerLeave(peerId => {
        console.log(`${peerId} left`);
        numPlayers -= 1;
    });

    [sendCellPlayed, getCellPlayed] = room.makeAction('cellPlayed');
    [sendResultValidation, getResultValidation] = room.makeAction('resultV');
    [sendRestartGame, getRestartGame] = room.makeAction('restartGame');

    getCellPlayed(handleCellPlayedPeer);
    getResultValidation(handleResultValidation);
    getRestartGame(handleRestartGame);

}