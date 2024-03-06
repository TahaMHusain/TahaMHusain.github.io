import {joinRoom, selfId} from '../trystero-torrent.min.js';

main();

function main () {
    const config = {"appId": "test-room"};
    const content_el = document.getElementById("content");
    const queryString = window.location.search;
    if (queryString.length > 1) {
        runClient(config, queryString, content_el);
    } else {
        runHost(config, content_el);
    };
};

/**
 * Host logic
 * @param {Object} config - Config data for room (passed to joinRoom)
 * @param {Element} content_el
 */
function runHost (config, content_el) {
    console.log("No query string found!")

    content_el.innerHTML = `
        <br>
        <button id="send-token">Send Token</button>
        <br>
        <p>Room link:</p>
        <p id="room-link"></p>
    `

    const roomCode = (Math.random() + 1).toString(36).substring(7);
    const room = joinRoom(config, roomCode);

    const roomLink = document.getElementById("room-link");
    roomLink.innerHTML = window.location.href + "?roomCode=" + roomCode;

    const sendToken = room.makeAction("tok")[0];
    const sendTokenButton = document.getElementById("send-token");
    sendTokenButton.addEventListener('click', () => {
        console.log("Sending token to all peers");
        sendToken("tok");
    });
};

/**
 * Client logic
 * @param {Object} config - Config data for room (passed to joinRoom)
 * @param {String} queryString - URL query string
 * @param {Element} content_el
 */
function runClient (config, queryString, content_el) {
    console.log("Found query string!")

    content_el.innerHTML = `
        <br>
        <button id="getting-tokens">Stop Getting Tokens</button>
        <br>
        <p>Tokens received:</p>
        <p id="token-count">0</p>

    `

    const urlParams = new URLSearchParams(queryString);
    const room = joinRoom(config, urlParams.get("roomCode"));
    let getToken = room.makeAction("tok")[1];
    const tokenCountDisplay = document.getElementById("token-count");
    getToken((peerId, data) => {
        let tokenCount = parseInt(tokenCountDisplay.innerHTML);
        tokenCountDisplay.innerHTML = tokenCount + 1;
        console.log("Received token from " + peerId);
    });

    const gettingTokens = document.getElementById("getting-tokens");
    gettingTokens.addEventListener('click', () => {
        let tokenGettingState = gettingTokens.innerHTML;
        if (tokenGettingState === "Stop Getting Tokens") {
            /**
             * This doesn't work; you have to reset the return value
             * of the already ran function, not just change the variable
             * getToken = undefined;
             */
            // End the callback by making the return value noOp
            // (it's noOp by default - running makeAction sets all 3
            // as properties of the room Object)
            gettingTokens(() => {});
            gettingTokens.innerHTML = "Start Getting Tokens";
        } else {
            getToken((peerId, data) => {
                let tokenCount = parseInt(tokenCountDisplay.innerHTML);
                tokenCountDisplay.innerHTML = tokenCount + 1;
                console.log("Received token from " + peerId);
            });
            
            gettingTokens.innerHTML = "Stop Getting Tokens";

        };

    });




};