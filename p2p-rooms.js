import {joinRoom, selfId} from './trystero-torrent.min.js';

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Joines created room (unless room is full)
 * @param {string} roomCode     code of room to join
 * @param {string} hostId       peer id of room host
 * @param {object} config       config object required by joinRoom
 * @param {number} MAX_PLAYERS  number of players allowed in a room
 * 
 * @returns {boolean} 
 *  [0]: whether or not room was joined
 */
async function joinCreatedRoom(roomCode, hostId, config, MAX_PLAYERS) {
    // Create global vars for the room and masterPeerDict
    globalThis.room = undefined;
    globalThis.masterPeerDict = undefined;
    room = joinRoom(config, roomCode);
    const joinTime = Date.now();
    startClientListeners();

    // Create func for sending join time
    const sendJoinTime = room.makeAction("joinTime")[0];
    // Check if host is in room yet
    let foundHost = Object.keys(room.getPeers()).includes(hostId);
    // Set 1m timeout on finding host
    hostJoinTimeout = setTimeout(
        () => {
            console.log("Failed to join room " + roomCode + ": host not found");
            return false;
        },
        60000
    );
    // Keep checking until the host is found
    while (!foundHost) {
        peerList = Object.keys(room.getPeers());
        foundHost = peerList.includes(hostId);
    }
    clearTimeout(hostJoinTimeout);

    // Request the masterPeerDict from host
    const requestMasterDict = room.makeAction("reqMD")[0];
    requestMasterList("reqMD");
    // Wait until masterPeerDict is sent over
    while (masterPeerDict === undefined) {
        await delay(100);
    };
    // If room is full, leave
    if (Object.keys(masterPeerDict).length + 1 > MAX_PLAYERS) {
        room.leave()
        console.log("Failed to join room " + roomCode + ": room is full!")
        return false;
    }
    // Send the join time to the host
    sendJoinTime(joinTime, hostId);

    return true;
}

/**
 * Creates (& joins) a new room
 * NOTE: sets masterPeerDict as global variable
 * @param {object} config       config object required by joinRoom
 * 
 * @returns {!Array<
 *      boolean,        
 *      Object|null
 * >}
 *  [0]: whether or not room was created
 *  [1]: room code of created room (null if no room created)
 */
async function createRoom(config) {
    // Create global vars for the room and masterPeerDict
    globalThis.room;
    globalThis.masterPeerDict;
    // Initialize count to start while loop
    let numPeers = 1, roomCode;
    // Set 1min timeout on creating empty room
    createRoomTimeout = setTimeout(
        () => {
            console.log("Failed to create room!");
            return [false, null];
        },
        60000
    );
    // Repeat until an empty room is found
    while (numPeers > 0) {
        // Get random string for room code and join
        roomCode = (Math.random() + 1).toString(36).substring(7);
        room = joinRoom(config, roomCode);
        // 5s delay to find all peers in room
        await delay(5000);
        // Find number of peers in room
        numPeers = Object.keys(room.getPeers()).length;
    }
    clearTimeout(createRoomTimeout);
    // Record join time
    let joinTime = Date.now();

    // Keep master object of peers in room as global var
    masterPeerDict = {[selfId]: {
        "isHost": true,
        "joinTime": joinTime,
    }};
    startHostListeners();
    return [true, roomCode];
}

/**
 * Starts listener functions for host peer to use
 */
function startHostListeners() {
    // Func to receive master dict requests from peers
    const receiveRequestMD = room.makeAction("reqMD")[1];
    // Listen for requests for master list and send them
    receiveRequestMD(e => {
        room.makeAction("masterDict")[0](masterPeerDict);
    })
    // Func to receive join times forom entering peers
    const getJoinTime = room.makeAction("joinTime")[1];
    // Listen for peers sending join times
    getJoinTime((t, id) => {
        // Update master list with new join time
        masterPeerDict.push({[id]: {
            "isHost": false,
            "joinTime": t
        }});
        // Send updated master list to all peers
        room.makeAction("masterDict")[0](masterPeerDict);
    });
}

/**
 * Starts listener functions for client peer to use
 */
function startClientListeners() {
    const getMasterDict = room.makeAction("masterDict")[1];
    // Listen for the host sending updates to masterPeerDict
    getMasterDict(m => {
        masterPeerDict = m;
    });
}

export {createRoom, joinCreatedRoom};