import {joinRoom, selfId} from '../lib/trystero-torrent.js';

const delay = ms => new Promise(res => setTimeout(res, ms));
let myFiles = [];

main();

async function main () {
    const contentEl = document.getElementById("content");
    const config = {"appId": "webnas"};
    const queryString = window.location.search;
    let roomCode;
    let room;
    let roomURL;
    if (queryString.length > 1) {
        const urlParams = new URLSearchParams(queryString);
        roomCode = urlParams.get("roomCode");
        console.log("Room code: " + roomCode);
        room = joinRoom(config, roomCode);
        room.onPeerJoin(peerId => console.log(`${peerId} joined`));
        contentEl.innerHTML = `
        <p> Joining room... </p>
        `;
        await delay(5000);
        roomURL = window.location.href;
    } else {
        // Create naive, unsecure UUID
        roomCode = '' + Math.random() + '' + Date.now();
        console.log("Room code: " + roomCode);
        room = joinRoom(config, roomCode);
        room.onPeerJoin(peerId => console.log(`${peerId} joined`));
        roomURL = window.location.href + "?roomCode=" + roomCode;
    };
    contentEl.innerHTML = `
        <p> View your files from other devices with this link: </p>
        <br>
        <a href=${roomURL}>${roomURL}</a>
        <br>
        <br>
        <input type="file" id="fileInput"></input>
        <br>
        <br>
        <ul id="fileListDisplay"></ul>
    `;
    const fileListDisplay = document.getElementById("fileListDisplay");

    const [sendFile, getFile, whileFile] = room.makeAction("file");
    getFile((data, peerId, metadata) => {
        console.log(
            `got a file (${metadata.name}) from ${peerId} with type ${metadata.type}`,
        );
        const file = new File([data], metadata.name);
        myFiles.push(file);
        fileListDisplay.innerHTML += `
            <li> <a href="${window.URL.createObjectURL(file)}" download="${metadata.name}">${metadata.name} </a> </li>
        `
    });

    const fileInput = document.getElementById("fileInput");
    fileInput.onchange = evt => {
        const file = fileInput.files[0];
        console.log("Adding file: " + file.name);
        myFiles.push(file);
        console.log("myFiles contents: " + myFiles)
        sendFile(file, null, {name: file.name, type: "file", path: file.webkitRelativePath});
        fileListDisplay.innerHTML += `
            <li> <a href="${window.URL.createObjectURL(file)}" download="${file.name}">${file.name} </a> </li>
        `
    };    

    const [sendReady, getReady] = room.makeAction("ready");
    console.log("sending ready...");
    sendReady("ready");
    getReady((data, peerId) => {
        console.log("Received ready");
        for (var i = 0; i < myFiles.length; i++) {
            console.log("Sending file " + myFiles[i].name + " to peer id: " + peerId);
            sendFile(myFiles[i], peerId, {name: myFiles[i].name, type: "file", path: myFiles[i].webkitRelativePath});
        };
    });

};