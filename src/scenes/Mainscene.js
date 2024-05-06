import Phaser from "phaser";
import ControlPanel from "../entity/ControlPanel";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    //Current state, which holds the variables listed under socket
    this.state = {};
    this.pointer;
    this.dribbling;
    this.updateThreshold = 100; // Update every 100ms
    this.scoreTeamBlue = 0;
    this.scoreTeamRed = 0;
    this.scoreText;
    this.goalAnimationText;
    this.arrow = null;
  }

  preload() {
    this.load.spritesheet(
      "player",
      "sportsPack/PNG/Blue/characterBlue (3).png",
      {
        frameWidth: 29,
        frameHeight: 37,
      }
    );
    this.load.spritesheet(
      "otherPlayer",
      "sportsPack/PNG/Red/characterRed (3).png",
      {
        frameWidth: 29,
        frameHeight: 37,
      }
    );

    this.load.image("ball", "sportsPack/PNG/Equipment/ball_soccer2.png");
    this.load.image("mainroom", "Images/soccer-field3.png");

    //Referee
    this.load.image('refBod', 'sportsPack/PNG/Special/characterSpecial (4).png');
    this.load.image('refHand', 'sportsPack/PNG/Special/characterSpecial (11).png');
    this.load.image('refFlag', 'sportsPack/PNG/Equipment/flag_green.png');
  }

  create() {
    const scene = this;
    //BACKGROUND
    var pitchImage = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, "mainroom").setOrigin(0.5, 0.5);
    pitchImage.displayWidth = 1020;
    pitchImage.displayHeight = 510;

    const referee = this.add.container(50,10);

    const hand = this.add.image(10, 10, 'refHand'); 
    const body = this.add.image(0, 0, 'refBod'); 
    const flag = this.add.image(20, 3, 'refFlag'); // Referee's flag

    referee.add([flag,hand,body]);
    referee.setScale(0.65);
    referee.setRotation(Math.PI/2)

    const referee2 = this.add.container(scene.game.config.width-60,scene.game.config.height-10);

    const hand2 = this.add.image(10, 10, 'refHand'); 
    const body2 = this.add.image(0, 0, 'refBod'); // Body
    const flag2 = this.add.image(20, 3, 'refFlag'); // Referee's flag
    referee2.add([hand2,flag2,body2]);
    referee2.setScale(0.65);
    referee2.setRotation(Math.PI*(3/2));

    this.createGoals();

    this.createScoreboard();

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
      const {
        roomKey,
        players,
        numPlayers,
        ball,
        scoreTeamBlue,
        scoreTeamRed,
      } = state;
      scene.physics.resume();

      // STATE
      scene.state.roomKey = roomKey;
      scene.state.players = players;
      scene.state.numPlayers = numPlayers;
      scene.state.ball = ball;
      console.log("new state set", state);
      scene.scoreTeamBlue = scoreTeamBlue;
      scene.scoreTeamRed = scoreTeamRed;
      scene.updateScoreUI();
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
    this.socket.on("initializeBall", async function (arg) {
      console.log("ball initilaized", scene);
      console.log("check", this);
      const { ballInfo } = arg;
      await scene.addBall(scene, ballInfo);
      scene.setupBallInteractions();
    });

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

    this.socket.on("updateBallPosition", function (data) {
      console.log("Update Ball init", data);

      if (!scene.recentShootEvent) {
        console.log("update ball init inside");
        scene.ball.setPosition(data.x, data.y);
      }
    });

    this.socket.on("shootBall", function (data) {
      const { velX, velY } = data;
      console.log("shotting ball");
      scene.ball.setVelocityX(velX);
      scene.ball.setVelocityY(velY);
      scene.recentShootEvent = true;
      setTimeout(() => {
        console.log("TIMEOUT");
        scene.recentShootEvent = false; // Reset the flag after the update is processed
      }, 100);
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.spacebar = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
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
    if (scene.ball) {
      if (
        Phaser.Geom.Rectangle.ContainsPoint(
          this.goalLeft,
          scene.ball.getCenter()
        )
      ) {
        this.scoreGoal("left");
      }
      if (
        Phaser.Geom.Rectangle.ContainsPoint(
          this.goalRight,
          scene.ball.getCenter()
        )
      ) {
        this.scoreGoal("right");
      }
    }

    //MOVEMENT
    if (this.player) {
      if (this.arrow) {
        const arrowSize = 20;
        this.arrow.clear();
        this.createArrow();
      }
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

      const angleToPointer = Phaser.Math.Angle.Between(
        x,
        y,
        pointer.worldX,
        pointer.worldY
      );
      this.player.setRotation(angleToPointer);

      if (
        this.player.oldPosition &&
        (x !== this.player.oldPosition.x ||
          y !== this.player.oldPosition.y ||
          angleToPointer != this.player.oldPosition.rotation)
      ) {
        this.moving = true;
        this.socket.emit("playerMovement", {
          x: this.player.x,
          y: this.player.y,
          rotation: angleToPointer,
          roomKey: scene.state.roomKey,
        });
      }
      // save old position data to create the "moving effect"
      this.player.oldPosition = {
        x: this.player.x,
        y: this.player.y,
        rotation: this.player.rotation,
      };
    }

    if (this.dribbling) {
      const dribbleDistance = 16; // Distance from player to keep the ball
      const angleToPointer = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        this.input.activePointer.worldX,
        this.input.activePointer.worldY
      );
      if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
        /*
        this.ball.setVelocityX(Math.cos(angleToPointer) * 400);
        this.ball.setVelocityY(Math.sin(angleToPointer) * 400)
        this.dribbling = false;*/
        this.shootBall(angleToPointer);
      } else {
        this.ball.x =
          this.player.x + dribbleDistance * Math.cos(angleToPointer);
        this.ball.y =
          this.player.y + dribbleDistance * Math.sin(angleToPointer);
      }

      // If dribbling, ensure that the ball update is sent
      this.socket.emit("ballMovement", {
        x: this.ball.x,
        y: this.ball.y,
        dribbling: true,
        roomKey: this.state.roomKey,
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
    if (!this.dribbling && this.canSteal()) {
      console.log("Can steal the ball");
      this.dribbling = true;
    }
  }
  handleOtherPlayerBallCollision(player, ball) {
    // Check if there is a player currently dribbling the ball
    console.log("the other player stoll the ball");
    this.dribbling = false;
    this.initStealCooldown();
  }

  canSteal() {
    const now = Date.now();
    return !this.lastStealTime || now - this.lastStealTime > 3000; // 3 seconds cooldown
  }
  initStealCooldown() {
    this.lastStealTime = Date.now();
    setTimeout(() => {
      // This timeout simply marks the end of the cooldown period
      this.lastStealTime = null;
    }, 100); // 3 seconds before another steal can happen
  }

  addPlayer(scene, playerInfo) {
    scene.joined = true;
    let playerType = "otherPlayer";
    if (playerInfo.bluePlayer) {
      playerType = "player";
    }
    scene.player = scene.physics.add
      .sprite(playerInfo.x, playerInfo.y, playerType)
      .setOrigin(0.5, 0.5)
      .setSize(30, 40)
      .setOffset(0, 24)
      .setCollideWorldBounds(true);
    
    // Create an arrow above the player
    this.createArrow();
  }
  addBall(scene, ballInfo) {
    scene.ball = scene.physics.add
      .sprite(ballInfo.x, ballInfo.y, "ball")
      .setOrigin(0.5, 0.5)
      .setBounce(0.4)
      .setDrag(30)
      .setCollideWorldBounds(true);
    console.log("is it added", scene);
    this.setupBallInteractions();
    if (this.otherPlayers) {
      console.log("adding other player collission in ball addittion");
      this.otherPlayers.getChildren().forEach((otherPlayer) => {
        this.physics.add.overlap(
          otherPlayer,
          scene.ball,
          this.handleOtherPlayerBallCollision,
          null,
          this
        );
      });
    }
  }
  setupBallInteractions(scene) {
    console.log("setup interaction", this.player, this);
    this.physics.add.collider(
      this.player,
      this.ball,
      this.handleBallCollision,
      null,
      this
    );
  }

  stopDribbling() {
    this.dribbling = false;
    this.dribblingPlayer = null;
    // Emit stop dribbling state
    this.socket.emit("ballMovement", {
      x: this.ball.x,
      y: this.ball.y,
      dribbling: false,
      roomKey: this.state.roomKey,
    });
  }
  createArrow() {
    const arrowSize = 7;  // Size of the arrow
    this.arrow = this.add.graphics({ fillStyle: { color: 0xffffff } });
    this.arrow.fillTriangle(
      this.player.x - arrowSize / 2, this.player.y - this.player.displayHeight / 2 - 10, // Left side of the base
      this.player.x + arrowSize / 2, this.player.y - this.player.displayHeight / 2 - 10, // Right side of the base
      this.player.x, this.player.y - this.player.displayHeight / 2 - 3 // Bottom point of the arrow
    );
    this.arrow.setDepth(10);  // Ensure the arrow is above most other objects
  }

  shootBall(angleToPointer) {
    if (!this.dribbling) return;
    let velX = Math.cos(angleToPointer) * 400;
    let velY = Math.sin(angleToPointer) * 400;
    console.log("veLX, VELy", velX, velY);
    this.socket.emit("shootBall", {
      velX: velX,
      velY: velY,
      dribbling: false,
      roomKey: this.state.roomKey,
    });

    this.ball.setVelocityX(velX);
    this.ball.setVelocityY(velY);
    console.log("reaches end of shoot ball!!");
    this.dribbling = false;
  }
  addOtherPlayers(scene, playerInfo) {
    let playerType = "otherPlayer";
    if (playerInfo.bluePlayer) {
      playerType = "player";
    }
    const otherPlayer = scene.add.sprite(
      playerInfo.x + 40,
      playerInfo.y + 40,
      playerType
    );
    otherPlayer.playerId = playerInfo.playerId;
    scene.otherPlayers.add(otherPlayer);

    if (scene.ball) {
      console.log("collisison between other players added");
      this.physics.add.overlap(
        otherPlayer,
        this.ball,
        this.handleOtherPlayerBallCollision,
        null,
        this
      );
    } else {
      console.log("no ball was initialized to add collission to other player");
    }
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

  createGoals() {
    const scene = this;
    this.goalLeftGraphics = this.add.graphics({
      fillStyle: { color: 0xff0000 },
    }); // Red for left goal
    this.goalRightGraphics = this.add.graphics({
      fillStyle: { color: 0x0000ff },
    });
    // Define the goal areas, adjust sizes and positions according to your game field
    this.goalRight = new Phaser.Geom.Rectangle(
      5,
      scene.game.config.height / 2 - 67.5,
      15,
      135
    );
    this.goalLeft = new Phaser.Geom.Rectangle(
      scene.game.config.width - 20,
      scene.game.config.height / 2 - 67.5,
      15,
      135
    );

    this.goalLeftGraphics.fillRectShape(this.goalLeft);
    this.goalRightGraphics.fillRectShape(this.goalRight);

  }

  scoreGoal(side) {
    const now = this.time.now;
    if (this.lastGoalTime && (now - this.lastGoalTime < 100)) {
        return; // Prevents scoring if last goal was less than 1 second ago
    }

    if (side === "left") {
      console.log("hit left")
      this.scoreTeamBlue++; 
    } else {
      console.log("hit right")
      this.scoreTeamRed++; 
    }

    console.log(
      `Goal scored on ${side} side! Score - Left: ${this.scoreTeamLeft}, Right: ${this.scoreTeamRight}`
    );
    this.socket.emit("goalScored", {
      scoreTeamBlue:this.scoreTeamBlue,
      scoreTeamRed:this.scoreTeamRed,
      roomKey: this.state.roomKey,
    });


    this.updateScoreUI();
    this.showGoalAnimation(side);
    this.lastGoalTime = now;
  }
  createScoreboard() {
    const style = { font: "30px Georgia", fill: "#ffffff"};
    this.scoreText = this.add
      .text(
        this.cameras.main.centerX,
        10,
        `Blue: ${this.scoreTeamBlue} - Red: ${this.scoreTeamRed}`,
        style
      )
      .setOrigin(0.5, 0);
  }
  updateScoreUI() {
    console.log("score ui updating", this.scoreTeamBlue, this.scoreTeamRed);
    this.scoreText.setText(
      `Blue: ${this.scoreTeamBlue} - Red: ${this.scoreTeamRed}`
    );
  }
  showGoalAnimation(side) {
    const style = {
      font: "48px Georgia",
      fill: "#ff0000",
      stroke: "#ffffff",
      strokeThickness: 6,
    };
    if (!this.goalAnimationText) {
      this.goalAnimationText = this.add
        .text(
          this.cameras.main.centerX,
          this.cameras.main.centerY,
          "GOAL!",
          style
        )
        .setOrigin(0.5);
    } else {
      this.goalAnimationText.setText("GOAL!!!");
      this.goalAnimationText.setVisible(true);
    }

    // Animation lasts 300ms then disappears
    this.time.delayedCall(
      300,
      () => {
        this.goalAnimationText.setVisible(false);
      },
      [],
      this
    );
  }
}
