// Adapted from https://github.com/arasgungore/Tic-Tac-Toe

import {joinRoom, selfId} from '../trystero-torrent.min.js';
import {Player} from "./p2p-rooms.js";
import {HTMLTempls} from "./html_templates.js";

/**
 * TODO:
 *  - Replace global variables with something more systematic
 */

const id2player = {0: "X", 1: "O"};

let gameActive = true;
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];

let playerPosition;
let sendResultValidation;
let sendCellPlayed;
let sendRestartGame;
let statusDisplay;
let room;
let masterPeerDict;

const config = {"appId": "tictactoe_test"};
const MAX_PLAYERS = 2;
const MIN_PLAYERS = 2;

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

    if(gameState[clickedCellIndex] !== "" || currentPlayer !== id2player[playerPosition] || !gameActive)
        return;

    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
    sendCellPlayed(clickedCellIndex);
    sendResultValidation("resultV");
    
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
    sendRestartGame("restartGame");
}

async function startup() {
    console.log("Running startup func!")
    const queryString = window.location.search;
    let player;
    if (queryString.length > 1) {
        console.log("Found query string!")
        const urlParams = new URLSearchParams(queryString);
        player = new Player(
            config,
            undefined,
            document.getElementById("content"),
            HTMLTempls,
            MAX_PLAYERS,
            MIN_PLAYERS,
            urlParams.get("roomCode"),
            urlParams.get("hostId")
        );
    } else {
        player = new Player(
            config,
            undefined,
            document.getElementById("content"),
            HTMLTempls,
            MAX_PLAYERS,
            MIN_PLAYERS
        )
    };

    // Function that returns a promise that resolves when the variable changes
    const waitForGameStart = () => {
        return new Promise((resolve) => {
            const checkVariable = () => {
                if ((player.currentPage === "gamePage") && (!(document.getElementById("leave-room") === null))) {
                    resolve();
                } else {
                    setTimeout(checkVariable, 100);
                };
            };

            checkVariable();
        });
    };
    await waitForGameStart();
    startGame(player);
}

function leaveGame() {
    room.leave();
    document.querySelectorAll('.game').forEach(e => e.remove());
    startup();
}

function startGame(player) {
    room = player._room;
    masterPeerDict = player.masterPeerDict;
    console.log("Starting game...")

    // Assign player order by alphabetical order of selfId
    let m = player.masterPeerDict;
    let selfObj = m[selfId];
    let playerList = Object.values(m).sort((a, b) => a["joinTime"] - b["joinTime"]).map(e => JSON.stringify(e));
    playerPosition = playerList.indexOf(JSON.stringify(selfObj));

    const leaveRoomButton = document.getElementById("leave-room");
    console.log("Found leaveRoomButton? : " + leaveRoomButton);
    leaveRoomButton.addEventListener('click', leaveGame);

    let getCellPlayed;
    let getResultValidation;
    let getRestartGame;

    [sendCellPlayed, getCellPlayed] = player._room.makeAction("cellPlayed");
    [sendResultValidation, getResultValidation] = player._room.makeAction("resultV");
    [sendRestartGame, getRestartGame] = player._room.makeAction("restartGame");

    getCellPlayed(handleCellPlayedPeer);
    getResultValidation(handleResultValidation);
    getRestartGame(handleRestartGame);

    document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', handleCellClick));
    document.querySelector('.game--restart').addEventListener('click', handleRestartClick);

    let thisPlayer = document.getElementById("this-player-msg");
    thisPlayer.innerHTML = "You're playing as " + id2player[playerPosition];

    statusDisplay = document.getElementById("current-player-msg");
    statusDisplay.innerHTML = currentPlayerTurn();


}