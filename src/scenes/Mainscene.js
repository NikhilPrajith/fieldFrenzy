import Phaser from "phaser";
import ControlPanel from "../entity/ControlPanel";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    //Current state, which holds the variables listed under socket
    this.state = {};
    this.vendingMachineStatus = false;
    this.pointer;
    this.dribbling;
  }

  preload() {
    this.load.spritesheet("player", "sportsPack/PNG/Blue/characterBlue (3).png", {
      frameWidth: 29,
      frameHeight: 37,
    });
    this.load.spritesheet("otherPlayer", "sportsPack/PNG/Red/characterRed (3).png", {
        frameWidth: 29,
        frameHeight: 37,
      });

    this.load.image('ball','sportsPack/PNG/Equipment/ball_soccer2.png');
    this.load.image("mainroom", "Images/soccer-field3.png");
  }

  
  create() {
    const scene = this;
    //BACKGROUND
    var pitchImage = this.add.image(0, 0, "mainroom").setOrigin(0,0);
    pitchImage.displayWidth=1020;
    pitchImage.displayHeight=510;
    
    //--------FOR TESTING ========

    //-----FOR TESTING =========

    //CREATE SOCKET
    this.socket = io();

    //LAUNCH WAITING ROOM
    scene.scene.launch("WaitingRoom", { socket: scene.socket });

    // CREATE OTHER PLAYERS GROUP
    this.otherPlayers = this.physics.add.group();

    // JOINED ROOM - SET STATE
    this.socket.on("setState", function (state) {
      const { roomKey, players, numPlayers, ball } = state;
      scene.physics.resume();

      // STATE
      scene.state.roomKey = roomKey;
      scene.state.players = players;
      scene.state.numPlayers = numPlayers;
      scene.state.ball = ball
    });

    // PLAYERS
    this.socket.on("currentPlayers", function (arg) {
      const { players, numPlayers } = arg;
      scene.state.numPlayers = numPlayers;
      Object.keys(players).forEach(function (id) {
        if (players[id].playerId === scene.socket.id) {
          scene.addPlayer(scene, players[id]);
        } else {
          scene.addOtherPlayers(scene, players[id]);
        }
      });
    });

    //INITIALIZE BALL
    this.socket.on("initializeBall", async function (arg){
        console.log("ball initilaized", scene)
        console.log("check", this);
        const {ballInfo} = arg;
        await scene.addBall(scene, ballInfo);
        scene.setupBallInteractions();
    })

    this.socket.on("newPlayer", function (arg) {
      const { playerInfo, numPlayers } = arg;
      scene.addOtherPlayers(scene, playerInfo);
      scene.state.numPlayers = numPlayers;
      // Mouse pointer
    });

    this.socket.on("playerMoved", function (playerInfo) {
      scene.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerInfo.playerId === otherPlayer.playerId) {
          const oldX = otherPlayer.x;
          const oldY = otherPlayer.y;
          otherPlayer.setPosition(playerInfo.x, playerInfo.y);
          otherPlayer.setRotation(playerInfo.rotation);
        }
      });
    });

      this.socket.on("otherPlayerStopped", function (playerInfo) {
        scene.otherPlayers.getChildren().forEach(function (otherPlayer) {
          if (playerInfo.playerId === otherPlayer.playerId) {
            otherPlayer.anims.stop(null, true);
          }
        });
    });

    this.socket.on("updateBallPosition", function(data) {
      console.log("Update Ball init", data);

      if (!scene.recentShootEvent) {
        console.log("update ball init inside")
          scene.ball.setPosition(data.x, data.y);
      }
  });

this.socket.on("shootBall", function(data) {
  const{velX, velY} = data;
  console.log("shotting ball");
  scene.ball.setVelocityX(velX);
  scene.ball.setVelocityY(velY);
  scene.recentShootEvent = true;
  setTimeout(() => {
    console.log("TIMEOUT")
    scene.recentShootEvent = false; // Reset the flag after the update is processed
}, 100); 
});

    

    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    /*
    //Error with using wasd, when you use these character before game load the player moves infinitely
    this.cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    */
    console.log("player", this);


    // DISCONNECT
    this.socket.on("disconnected", function (arg) {
      const { playerId, numPlayers } = arg;
      scene.state.numPlayers = numPlayers;
      scene.otherPlayers.getChildren().forEach(function (otherPlayer) {
        if (playerId === otherPlayer.playerId) {
          otherPlayer.destroy();
        }
      });
    });
  }

  update() {
    const scene = this;
    //MOVEMENT
    if (this.player) {
      const speed = 225;
      const prevVelocity = this.player.body.velocity.clone();
      // Stop any previous movement from the last frame
      this.player.body.setVelocity(0);
      // Horizontal movement
      if (this.cursors.left.isDown) {
        this.player.body.setVelocityX(-speed);
      } else if (this.cursors.right.isDown) {
        this.player.body.setVelocityX(speed);
      }
      // Vertical movement
      if (this.cursors.up.isDown) {
        this.player.body.setVelocityY(-speed);
      } else if (this.cursors.down.isDown) {
        this.player.body.setVelocityY(speed);
      }




      // Normalize and scale the velocity so that player can't move faster along a diagonal
      this.player.body.velocity.normalize().scale(speed);

      // emit player movement
      var x = this.player.x;
      var y = this.player.y;


      const pointer = this.input.activePointer;

      const angleToPointer = Phaser.Math.Angle.Between(x, y, pointer.worldX, pointer.worldY);
      this.player.setRotation(angleToPointer);

      if (
        this.player.oldPosition &&
        (x !== this.player.oldPosition.x ||
          y !== this.player.oldPosition.y || angleToPointer != this.player.oldPosition.rotation)
      ) {
        this.moving = true;
        this.socket.emit("playerMovement", {
          x: this.player.x,
          y: this.player.y,
          rotation:angleToPointer,
          roomKey: scene.state.roomKey,
        });
      }
      // save old position data to create the "moving effect"
      this.player.oldPosition = {
        x: this.player.x,
        y: this.player.y,
        rotation:this.player.rotation
      };
    }
    /*
    const currentTime = this.time.now; // Get the current time
    if (this.ball) {
        const ballMoved = this.lastBallPos && (this.ball.x !== this.lastBallPos.x || this.ball.y !== this.lastBallPos.y);
        if (ballMoved && currentTime - this.lastBallUpdate > this.ballUpdateThreshold) {
            this.socket.emit("ballMovement", {
                x: this.ball.x,
                y: this.ball.y
            });
            this.lastBallUpdate = currentTime; // Update the last update timestamp
        }
        this.lastBallPos = { x: this.ball.x, y: this.ball.y }; // Always update the last known position
    }*/
  
   if (this.dribbling) {
      const dribbleDistance = 16; // Distance from player to keep the ball
      const angleToPointer = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.input.activePointer.worldX, this.input.activePointer.worldY);
      if(Phaser.Input.Keyboard.JustDown(this.spacebar)){
        /*
        this.ball.setVelocityX(Math.cos(angleToPointer) * 400);
        this.ball.setVelocityY(Math.sin(angleToPointer) * 400)
        this.dribbling = false;*/
        this.shootBall(angleToPointer);
      }else{
        this.ball.x = this.player.x + dribbleDistance * Math.cos(angleToPointer);
        this.ball.y = this.player.y + dribbleDistance * Math.sin(angleToPointer);
      }

      // If dribbling, ensure that the ball update is sent
      this.socket.emit('ballMovement', {
          x: this.ball.x,
          y: this.ball.y,
          dribbling: true,
          roomKey: this.state.roomKey
      });
    }


    /*
    if (this.dribbling) {
      // Make the ball follow the player while dribbling
      // Adjust these offsets to position the ball correctly relative to your player sprite
      this.ball.x = this.dribblingPlayer.x + 20;
      this.ball.y = this.dribblingPlayer.y;
  
      // Handle shooting (example: on spacebar press)
      if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE))) {
        this.shootBall();
      }
    }*/
  }

  handleBallCollision(player, ball) {
    // Check if there is a player currently dribbling the ball
    this.dribbling = true;
}

// Example function to determine if a steal is successful
attemptSteal(player) {
    // Simple rule: steal if the player is within a certain distance and the opponent is not actively dribbling (could add more complex rules)
    let distance = Phaser.Math.Distance.Between(this.dribblingPlayer.x, this.dribblingPlayer.y, player.x, player.y);
    return distance < 50; // Example threshold
}




  addPlayer(scene, playerInfo) {
    scene.joined = true;
    let playerType = 'otherPlayer';
    if(playerInfo.bluePlayer){
        playerType='player'
    }
    scene.player = scene.physics.add
      .sprite(playerInfo.x, playerInfo.y, playerType)
      .setOrigin(0.5, 0.5)
      .setSize(30, 40)
      .setOffset(0, 24)
      .setCollideWorldBounds(true);
  }
  addBall(scene,ballInfo){
    scene.ball = scene.physics.add
        .sprite(ballInfo.x,ballInfo.y,'ball')
        .setOrigin(0.5,0.5)
        .setBounce(0.4)
        .setDrag(30)
        .setCollideWorldBounds(true);
    console.log("is it added", scene)
  }
  setupBallInteractions(scene){
    console.log("setup interaction", this.player, this);
    this.physics.add.collider(this.player, this.ball, this.handleBallCollision, null, this);
  }

  stopDribbling() {
    this.dribbling = false;
    this.dribblingPlayer = null;
    // Emit stop dribbling state
    this.socket.emit('ballMovement', {
        x: this.ball.x,
        y: this.ball.y,
        dribbling: false,
        roomKey: this.state.roomKey
    });
  }

  shootBall(angleToPointer) {
    if (!this.dribbling) return;
    let velX = Math.cos(angleToPointer) * 400;
    let velY = Math.sin(angleToPointer) * 400;
    console.log("veLX, VELy", velX, velY);
    this.socket.emit('shootBall', {
      velX:velX,
      velY:velY,
      dribbling: false,
      roomKey: this.state.roomKey
    });
    
    this.ball.setVelocityX(velX);
    this.ball.setVelocityY(velY);
    console.log("reaches end of shoot ball!!");
    this.dribbling = false;
    

  }
  addOtherPlayers(scene, playerInfo) {
    let playerType = 'otherPlayer';
    if(playerInfo.bluePlayer){
        playerType='player'
    }
    const otherPlayer = scene.add.sprite(
      playerInfo.x + 40,
      playerInfo.y + 40,
      playerType
    );
    otherPlayer.playerId = playerInfo.playerId;
    scene.otherPlayers.add(otherPlayer);
  }


  checkOverlap(scene, player, controlPanel) {
    const boundsPlayer = player.getBounds();
    const boundsPanel = controlPanel.getBounds();
    if (
      !Phaser.Geom.Intersects.RectangleToRectangle(boundsPlayer, boundsPanel)
    ) {
      scene.deactivateControlPanel(controlPanel);
    }
  }

  deactivateControlPanel(controlPanel) {
    controlPanel.clearTint();
    controlPanel.disableInteractive();
  }
}
