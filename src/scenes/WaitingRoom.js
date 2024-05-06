import Phaser from "phaser";

export default class WaitingRoom extends Phaser.Scene {
  constructor() {
    super("WaitingRoom");
    this.state = {};
    this.hasBeenSet = false;
  }

  init(data) {
    this.socket = data.socket;
  }

  preload() {
    this.load.html("codeform", "assets/text/codeform.html");
    this.load.image("playerKicking", "Images/playerImageUi.png");
  }

  create() {
    const scene = this;

    scene.popUp = scene.add.graphics();
    scene.boxes = scene.add.graphics();

    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    // for popup window
    scene.popUp.fillStyle(0x000000, 0.98);

    // for boxes
    scene.boxes.lineStyle(2, 0xffffff, 1);
    scene.boxes.fillStyle(0x000000, 1);

    // popup window
    scene.popUp.strokeRect(centerX - 475, centerY - 230, 950, 460);
    scene.popUp.fillRect(centerX - 475, centerY - 230, 950, 460);
    // Defining the popup window area as a mask
    let mask = scene.make.graphics();
    mask.fillStyle(0xffffff);  // Color doesn't matter but alpha does
    mask.beginPath();
    mask.fillRect(centerX - 475, centerY - 230, 950, 460);
    mask.closePath();
    mask.fillPath();

    scene.popUp.setMask(mask.createGeometryMask());


    const playerImage = this.add.image(centerX*2- 150, centerY, 'playerKicking').setOrigin(0.5, 0.5);
    playerImage.alpha = 0.4; 
    playerImage.setMask(mask.createGeometryMask());

    //title
    scene.title = scene.add.text(centerX-180, 75, "FIELD FRENZY", {
      fill: "#ffffff",
      fontSize: "50px",
      fontStyle: "bold",
      fontFamily:'Georgia',
    });

    //left popup
    scene.boxes.strokeRoundedRect(centerX-85, 150, 170, 60, 10);
    scene.boxes.fillRoundedRect(centerX-85, 150, 170, 60, 10);
    scene.requestButton = scene.add.text(centerX-50, 155, "Create key", {
      fill: "#ffffff",
      fontSize: "15px",
      fontStyle: "bold",
    });

    //right popup
    scene.boxes.strokeRoundedRect(centerX-132.5, 250, 265, 100, 10);
    scene.boxes.fillRoundedRect(centerX-132.5, 250, 265, 100, 10);
    scene.inputElement = scene.add.dom(510.5, 290).createFromCache("codeform");
    scene.inputElement.addListener("click");
    scene.inputElement.on("click", function (event) {
      if (event.target.name === "enterRoom") {
        const input = scene.inputElement.getChildByName("code-form");

        scene.socket.emit("isKeyValid", input.value);
      }
    });

    scene.requestButton.setInteractive();
    scene.requestButton.on("pointerdown", () => {
      scene.socket.emit("getRoomCode");
    });

    scene.notValidText = scene.add.text(670, 295, "", {
      fill: "#ff0000",
      fontSize: "15px",
    });
    scene.roomKeyText = scene.add.text(centerX-19, 180, "", {
      fill: "#00ff00",
      fontSize: "15px",
      fontStyle: "bold",
    });

    scene.socket.on("roomCreated", function (roomKey) {
      scene.roomKey = roomKey;
      scene.roomKeyText.setText(scene.roomKey);
    });

    scene.socket.on("keyNotValid", function () {
      scene.notValidText.setText("Invalid Room Key");
    });
    scene.socket.on("keyIsValid", function (input) {
      scene.socket.emit("joinRoom", input);
      scene.scene.stop("WaitingRoom");
    });
  }
  update() {}
}
