const HTMLTempls = {
    preCreateRoomPage: `
        <button class="startup" id="create-room-button">Create Room</button>
`,
    preStartGamePage:`
        <p class="startup">Waiting for other players...</p>
        <br class="startup">
        <p class="startup"> Link to room: </p>
        <span id="room-link" class="startup"> </span>
`,
    preJoinRoomPage: `
        <p class="startup">Joining room...</p>
`,
    preJoinGamePage: `
        <button class="startup" id="join-game-button">Join Game</button>  
`,
    gamePage: `
    <br>
    <button id="leave-room" class="game--leave">Leave Room</button>
    <br>
    <br>
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
};
export {HTMLTempls};