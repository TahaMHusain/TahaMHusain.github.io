import {joinRoom, selfId} from './trystero-torrent.min.js';

function Player(
    config,
    roomCode,
    hostId,
    name,
    preCreateRoomPage,
    preStartGamePage,
    preJoinRoomPage,
    preJoinGamePage,
    gamePage,
    MAX_PLAYERS,
    MIN_PLAYERS = 0,
) {
    // Variable Declarations
    this.config = config;
    this.MIN_PLAYERS = MIN_PLAYERS;
    this.MAX_PLAYERS = MAX_PLAYERS;
    this.roomCode = roomCode;
    this.name = name;
    this.joinRoomPage = joinRoomPage;
    this.masterPeerDict = undefined;
    this.roomJoinQueryString = undefined;
    this._room = undefined;
    /**
     * Delays execution
     * @param {number}  milliseconds of delay
     */
    this._delay = ms => new Promise(res => setTimeout(res, ms));
    /**
     * Joins created room (unless room is full)
     * @param {string} hostId       peer id of room host
     */
    this._joinCreatedRoom = async (hostId) => {
        this._room = joinRoom(this.config, this.roomCode);
        const joinTime = Date.now();
        this.startClientListeners();
    
        // Create func for sending join time
        const sendJoinTime = this._room.makeAction("joinTime")[0];
        // Check if host is in room yet
        let foundHost = Object.keys(room.getPeers()).includes(hostId);
        // Set 1m timeout on finding host
        let hostJoinTimeout = setTimeout(
            () => {
                console.log("Failed to join room " + this.roomCode +
                            ": host not found");
                return;
            },
            60000
        );
        // Keep checking until the host is found
        while (!foundHost) {
            peerList = Object.keys(this._room.getPeers());
            foundHost = peerList.includes(hostId);
        }
        clearTimeout(hostJoinTimeout);
    
        // Request the masterPeerDict from host
        const requestMasterDict = this._room.makeAction("reqMPD")[0];
        requestMasterDict("reqMPD");
        // Wait until masterPeerDict is sent over
        while (this.masterPeerDict === undefined) {
            await this._delay(100);
        };
        // If room is full, leave
        if (Object.keys(this.masterPeerDict).length + 1 > this.MAX_PLAYERS) {
            this._room.leave()
            console.log("Failed to join room " + this.roomCode +
                        ": room is full!")
            return;
        }
        // Send the join time to the host
        sendJoinTime(joinTime, hostId);

        // Go straight to waiting room

    };
    /**
     * Creates (& joins) a new room
     * NOTE: sets masterPeerDict as global variable
     */
    this._createRoom = async (hostId) => {
        // Initialize count to start while loop
        let numPeers = 1;
        // Set 1min timeout on creating empty room
        let createRoomTimeout = setTimeout(
            () => {
                console.log("Failed to create room!");
                return;
            },
            60000
        );
        // Repeat until an empty room is found
        while (numPeers > 0) {
            // Get random string for room code and join
            this.roomCode = (Math.random() + 1).toString(36).substring(7);
            this._room = joinRoom(this.config, this.roomCode);
            // 5s delay to find all peers in room
            await this._delay(5000);
            // Find number of peers in room
            numPeers = Object.keys(this._room.getPeers()).length;
        }
        clearTimeout(createRoomTimeout);
        // Record join time
        let joinTime = Date.now();

        // Keep master object of peers in room as global var
        this.masterPeerDict = {[selfId]: {
            "isHost": true,
            "joinTime": joinTime,
        }};
        startHostListeners();
        const queryString = "roomCode=" + this.roomCode + "&hostId=" + selfId;
        this.roomJoinQueryString = queryString;
    };
    // TODO: clear out room-related property values
    this.leaveRoom = () => {
        if (this.masterPeerDict[selfId]["isHost"] === true) {
            this._leaveRoomHost();
        } else {
            this._leaveRoomClient();
        }
    },
    this._leaveRoomHost = () => {
        // If there's only one peer in the room, just empty the peer dict and leave
        if (Object.keys(this.masterPeerDict).length < 2) {
            masterPeerDict = undefined
            return;
        }
        // Remove own entry from peer dict
        delete this.masterPeerDict[selfId];
        // Get list of joinTimes and find the smallest (earliest) one
        let masterPeerList = []
        for (const value of Object.values(this.masterPeerDict)) {
            masterPeerList.push(value["joinTime"]);
        };
        earliestJoinTime = masterPeerList.sort()[0];
        // Get the peer of the earliest join time and make them the host
        earliestJoinedPeerId = Object.keys(this.masterPeerDict).find(k => {
            this.masterPeerDict[k]["joinTime"] === earliestJoinTime
        });
        this.masterPeerDict[earliestJoinedPeerId]["isHost"] = true;
        // Send out the updated list to everyone
        this._room.makeAction("MPD")[0](this.masterPeerDict);
        // Tell new host to promote
        this._room.makeAction("promote")[0]("", earliestJoinedPeerId);  
    };
    this._leaveRoomClient = () => {
        this._room.leave();
    };
    /**
     * Starts listener functions for host peer to use
     */
    this._startHostListeners = () => {
        // Func to receive master dict requests from peers
        const receiveRequestMD = this._room.makeAction("reqMPD")[1];
        // Listen for requests for master list and send them
        receiveRequestMD(e => {
            this._room.makeAction("MPD")[0](this.masterPeerDict);
        });
        // Func to receive join times forom entering peers
        const getJoinTime = this._room.makeAction("joinTime")[1];
        // Listen for peers sending join times
        getJoinTime((t, id) => {
            // Update master list with new join time
            this.masterPeerDict.push({[id]: {
                "isHost": false,
                "joinTime": t
            }});
            // Send updated master list to all peers
            this._room.makeAction("MPD")[0](this.masterPeerDict);
        });
        // Listen for peers leaving to update list and send out updated MPD
        this._room.onPeerLeave(peerId => {
            delete this.masterPeerDict[peerId];
            // Send updated master list to all peers
            this._room.makeAction("MPD")[0](this.masterPeerDict);
            // If there aren't enough players to keep playing, send everyone
            // back to the preStartGamePage
            if (Object.keys(this.masterPeerDict).length < this.MIN_PLAYERS) {
                this._room.makeAction("kicked")[0]();
                this.preStartGamePage();
            }
        })
    };
    /**
     * Starts listener functions for client peer to use
     */
    this._startClientListeners = () => {
        const getMasterDict = this._room.makeAction("MPD")[1];
        // Listen for the host sending updates to masterPeerDict
        getMasterDict(m => {
            this.masterPeerDict = m;
        });

        const getPromoteRequest = this._room.makeAction("promote")[1];
        // Listen for host telling user to promote to host
        getPromoteRequest(() => {
            this._promoteToHost();
        });

        const getKickedOutOfGame = this._room.makeAction("kicked")[1];
        // Listen for host telling user to go back to waiting room
        getKickedOutOfGame(() => {
            this.preStartGamePage();
        })
    };
    this._promoteToHost = () => {
        // TODO: remove the client listeners. Maybe import Peer class from library?
        this._startHostListeners();
    };

    // Object initialization
    roomCode === undefined ? this._createRoom() : this._joinCreatedRoom(hostId);
};

export {Player};