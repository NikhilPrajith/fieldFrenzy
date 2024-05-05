const gameRooms = {
  // [roomKey]: {
  // users: [],
  // randomTasks: [],
  // scores: [],
  // gameScore: 0,
  // players: {},
  // numPlayers: 0
  // blueOrGreen: true
  // }
};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(
      `A socket connection to the server has been made: ${socket.id}`
    );
    //for testing


    //---------

    socket.on("isKeyValid", function (input) {
      Object.keys(gameRooms).includes(input)
        ? socket.emit("keyIsValid", input)
        : socket.emit("keyNotValid");
    });
    //Get a random code for the room and set up the room state, intially all empty  
    socket.on("getRoomCode", async function () {
      let key = codeGenerator();
      while (Object.keys(gameRooms).includes(key)) {
        key = codeGenerator();
      }
      gameRooms[key] = {
        roomKey: key,
        players: {},
        numPlayers: 0,
        bluePlayer: true,
        bluePlayerCount: 0,
        redPlayerCount:0,
        ball:{x:510,y:255}
      };
      socket.emit("roomCreated", key);
    });
    socket.on("joinRoom", (roomKey) => {
      socket.join(roomKey);
      const roomInfo = gameRooms[roomKey];
      console.log("roomInfo", roomInfo);
      let lastRoomPlayerType = roomInfo.bluePlayer;

      let tempX, tempY;
      if(lastRoomPlayerType){
        tempX= 640+(40*roomInfo.redPlayerCount);
        tempY = 255
      }else{
        tempX = 410 - (40*roomInfo.bluePlayerCount);
        tempY = 255
      }


      roomInfo.players[socket.id] = {
        rotation: 0,
        x: tempX,
        y: tempY,
        playerId: socket.id,
        bluePlayer:!lastRoomPlayerType
      };
      roomInfo.bluePlayer = !lastRoomPlayerType
      console.log("counts", roomInfo);
      if(!lastRoomPlayerType){
        roomInfo.redPlayerCount +=1
      }else{
        roomInfo.bluePlayerCount += 1
      }

      // update number of players
      roomInfo.numPlayers = Object.keys(roomInfo.players).length;

      // set initial state
      socket.emit("setState", roomInfo);

      // send the players object to the new player
      socket.emit("currentPlayers", {
        players: roomInfo.players,
        numPlayers: roomInfo.numPlayers,
      });


      // update all other players of the new player
      socket.to(roomKey).emit("newPlayer", {
        playerInfo: roomInfo.players[socket.id],
        numPlayers: roomInfo.numPlayers,
      });

      socket.emit('initializeBall',{
        ballInfo: roomInfo.ball,
      });
    });

    // when a player moves, update the player data
    socket.on("playerMovement", function (data) {
      const { x, y, rotation, roomKey } = data;
      gameRooms[roomKey].players[socket.id].x = x;
      gameRooms[roomKey].players[socket.id].y = y;

      gameRooms[roomKey].players[socket.id].rotation = rotation;
      // emit a message to all players about the player that moved
      socket
        .to(roomKey)
        .emit("playerMoved", gameRooms[roomKey].players[socket.id]);
    });

    //BALL MOVEMENT
    socket.on("ballMovement", function(data) {
      console.log("ballMovementData", data)
      const {x,y, roomKey} = data;
      gameRooms[roomKey].ball.x = x;
      gameRooms[roomKey].ball.y = y;
      // Broadcast ball position to all other clients except the sender
      socket
        .to(roomKey)
        .emit("updateBallPosition", data);
    });
    socket.on("shootBall", function(data) {
      console.log("shootingBall", data)
      const {velX, velY,roomKey} = data;
      // Broadcast ball position to all other clients except the sender
      socket
        .to(roomKey)
        .emit("shootBall", data);
    });
  


    

    // when a player disconnects, remove them from our players object
    socket.on("disconnect", function () {
      //find which room they belong to
      let roomKey = 0;
      for (let keys1 in gameRooms) {
        for (let keys2 in gameRooms[keys1]) {
          Object.keys(gameRooms[keys1][keys2]).map((el) => {
            if (el === socket.id) {
              roomKey = keys1;
            }
          });
        }
      }

      const roomInfo = gameRooms[roomKey];

      if (roomInfo) {
        console.log("user disconnected: ", socket.id);
        // remove this player from our players object
        delete roomInfo.players[socket.id];
        // update numPlayers
        roomInfo.numPlayers = Object.keys(roomInfo.players).length;
        // emit a message to all players to remove this player
        io.to(roomKey).emit("disconnected", {
          playerId: socket.id,
          numPlayers: roomInfo.numPlayers,
        });
      }
    });
  });
};

function codeGenerator() {
  let code = "";
  let chars = "BCEFGHJKLMNPQRTUVYZ0123456789";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
