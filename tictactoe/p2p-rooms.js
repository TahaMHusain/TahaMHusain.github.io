import {joinRoom, selfId} from '../trystero-torrent.min.js';
// TODO: Replace currentPageFunc with object mapping strings to functions!
function Player(
    config,
    name,
    content_el,
    templs,
    MAX_PLAYERS,
    MIN_PLAYERS = 0,
    roomCode = undefined,
    hostId = undefined,
) {
    // Variable Declarations
    this.config = config;
    this.MIN_PLAYERS = MIN_PLAYERS;
    this.MAX_PLAYERS = MAX_PLAYERS;
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.name = name;
    this.masterPeerDict = undefined;
    this._room = undefined;

    this.currentPageFunc = undefined;
    this.content_el = content_el;
    this.templs = templs;
    /**
     * Function to delay execution
     * @param {number} ms   milliseconds of delay
     */
    this._delay = ms => new Promise(res => setTimeout(res, ms));

    /**
     * Joins created room (unless room is full)
     * @param {string} hostId       peer id of room host
     */
    this._joinCreatedRoom = async (hostId) => {
        console.log("In _joinCreatedRoom!")
        this._room = joinRoom(this.config, this.roomCode);
        console.log("Joined room " + roomCode + " with host " + hostId);
        const joinTime = Date.now();
        this._startClientListeners();
    
        // Check if host is in room yet
        let foundHost = Object.keys(this._room.getPeers()).includes(hostId);
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
        console.log("Looking for host...")
        this._room.onPeerJoin(peerId => {
            console.log(`${peerId} joined`);
            if (peerId === hostId) {
                clearTimeout(hostJoinTimeout);
                this._foundHostFunc(joinTime, hostId);
            }
        });
    };

    this._foundHostFunc = async (joinTime, hostId) => {
        console.log("Found host!")
        this._room.onPeerJoin(peerId => {
            console.log(`${peerId} joined`);
        });
        // Request the masterPeerDict from host
        console.log("Waiting for masterPeerDict...")
        // TODO: Make this actually wait for a promise to resolve!
        this._room.makeAction("reqMPD")[0]("reqMPD");
        // Function that returns a promise that resolves when the variable changes
        const waitForMPD = () => {
            return new Promise((resolve) => {
                const checkVariable = () => {
                    if (this.masterPeerDict === undefined) {
                        console.log("MPD not found yet! " + this.masterPeerDict);
                        // If not changed, wait for a short duration and check again
                        setTimeout(checkVariable, 1000);
                    } else {
                        resolve();
                    };
                };

                checkVariable();
            });
        };
        await waitForMPD();
        console.log("received masterPeerDict in _foundHostFunc! " + this.masterPeerDict)

        // If room is full, leave
        if (Object.keys(this.masterPeerDict).length + 1 > this.MAX_PLAYERS) {
            this._room.leave()
            console.log("Failed to join room " + this.roomCode +
                        ": room is full!")
            return;
        }
        // Create func for sending join time
        const sendJoinTime = this._room.makeAction("joinTime")[0];
        // Send the join time to the host
        sendJoinTime(joinTime, hostId);

        console.log("Waiting for current page info...");
        // Determine what page the host is on and go to that page
        this._room.makeAction("reqPage")[0]("reqPage");
        // Function that returns a promise that resolves when the variable changes
        const waitForCurPage = () => {
            return new Promise((resolve) => {
                const checkVariable = () => {
                    if (this.currentPageFunc === undefined) {
                        console.log("currentPageFunc not found yet! " + this.currentPageFunc);
                        // If not changed, wait for a short duration and check again
                        setTimeout(checkVariable, 1000);
                    } else {
                        resolve();
                    };
                };

                checkVariable();
            });
        };
        await waitForCurPage();
        this.currentPageFunc();
    }

    /**
     * Creates (& joins) a new room
     */
    this._createRoom = async () => {
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
        };
        clearTimeout(createRoomTimeout);
        // Record join time
        let joinTime = Date.now();
        // Log when someone joins the room
        this._room.onPeerJoin(peerId => {
            console.log(`${peerId} joined`);
        })

        // Keep master object of peers in room as global var
        this.masterPeerDict = {[selfId]: {
            "isHost": true,
            "joinTime": joinTime,
        }};
        this._startHostListeners();
        const queryString = "roomCode=" + this.roomCode + "&hostId=" + selfId;
        this.roomJoinQueryString = queryString;

        // Go to game the preStartGame page
        this.go2PreStartGamePage();
    };

    // TODO: clear out room-related property values
    this.leaveRoom = () => {
        if (this.masterPeerDict[selfId]["isHost"] === true) {
            this._leaveRoomHost();
        } else {
            this._leaveRoomClient();
        };
    };

    this._leaveRoomHost = () => {
        // If there's only one peer in the room, just empty the peer dict and leave
        if (Object.keys(this.masterPeerDict).length < 2) {
            masterPeerDict = undefined
            return;
        };
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
            this.masterPeerDict[id] = {
                "isHost": false,
                "joinTime": t
            };
            // Send updated master list to all peers
            this._room.makeAction("MPD")[0](this.masterPeerDict);
            // If in preStartGamePage, check if game should start
            if (Object.keys(this.masterPeerDict).length >= this.MIN_PLAYERS && this.currentPageFunc === this.go2PreStartGamePage) {
                this.go2GamePage();
                // this._room.makeAction("curPage")[0]({prop: this.go2GamePage});
            }
        });

        const getRequestForCurrentPage = this._room.makeAction("reqPage")[1];
        // Listen for requests for information about which page everyone is on
        getRequestForCurrentPage((e) => {
            // Send everyone the current page
            let c_obj = {prop: this.currentPageFunc};
            console.log("sending current page from host: " + c_obj);
            console.log("    including func at prop: " + c_obj.prop);
            this._room.makeAction("curPage")[0](c_obj);
        });

        // Listen for peers leaving to update list and send out updated MPD
        this._room.onPeerLeave(peerId => {
            delete this.masterPeerDict[peerId];
            // Send updated master list to all peers
            this._room.makeAction("MPD")[0](this.masterPeerDict);
            // If there aren't enough players to keep playing, send everyone
            // back to the preStartGamePage
            if (Object.keys(this.masterPeerDict).length < this.MIN_PLAYERS) {
                this.currentPageFunc = this.go2PreStartGamePage;
                // this._room.makeAction("curPage")[0]({prop: this.currentPageFunc});
                this.currentPageFunc();
            };
        });
    };

    /**
     * Starts listener functions for client peer to use
     */
    this._startClientListeners = () => {
        const getMasterDict = this._room.makeAction("MPD")[1];
        // Listen for the host sending updates to masterPeerDict
        getMasterDict(m => {
            console.log("received MasterPeerDict in MPD action! " + m);
            this.masterPeerDict = m;
        });

        const getPromoteRequest = this._room.makeAction("promote")[1];
        // Listen for host telling user to promote to host
        getPromoteRequest(() => {
            this._promoteToHost();
        });

        const getCurrentPage = this._room.makeAction("curPage")[1];
        // Listen for status updates about what page everyone's on
        getCurrentPage(c_obj => {
            console.log("Received c_obj: " + c_obj);
            console.log("    including func at prop: " + c_obj.prop);
            let c = c_obj.prop;
            console.log("getting current page!");
            if (this.currentPageFunc === undefined) {
                console.log("setting new currentPageFunc " + c);
                this.currentPageFunc = c;
            // If waiting in preStartGame and change to gamePage, go2GamePage
            } else if (this.currentPageFunc === this.go2PresStartGamePage && c === this.go2GamePage) {
                c();
            // If in gamePage and kicked, go2PreStartGamePage
            } else if (this.currentPageFunc === this.go2GamePage && c === this.go2PreStartGamePage) {
                c();
            };
        });
    };

    this._promoteToHost = () => {
        // TODO: remove the client listeners. Maybe import Peer class from library?
        this._startHostListeners();
    };

    /**
     * Page transition functions
     */
    this.go2PreCreateRoomPage = function () {
        console.log("going to preCreateRoomPage!")
        this.currentPageFunc = this.go2PreCreateRoomPage;
        this.content_el.innerHTML = this.templs.preCreateRoomPage;
        const createRoomButton = document.getElementById("create-room-button");
        createRoomButton.addEventListener('click', () => {
            this._createRoom();
        });
    };
    this.go2PreStartGamePage = function () {
        console.log("setting currentPageFunc to go2PreStartGamePage...");
        this.currentPageFunc = this.go2PreStartGamePage;
        this.content_el.innerHTML = this.templs.preStartGamePage;
        const roomLinkMsg = document.getElementById("room-link");
        roomLinkMsg.innerHTML = "<p> " + window.location.href + "?" + this.roomJoinQueryString + "</p>";
    };
    this.go2PreJoinRoomPage = function () {
        this.currentPageFunc = this.go2PreJoinRoomPage;
        this.content_el.innerHTML = this.templs.preJoinRoomPage;
    };
    this.go2PreJoinGamePage = function () {
        this.currentPageFunc = this.go2PreJoinGamePage;
        this.content_el.innerHTML = this.templs.preJoinGamePage;
    };
    this.go2GamePage = function () {
        this.currentPageFunc = this.go2GamePage;
        this.content_el.innerHTML = this.templs.gamePage;
    };

    // Object initialization
    this.roomCode === undefined ? this.go2PreCreateRoomPage() : this._joinCreatedRoom(hostId);
};

export {Player};