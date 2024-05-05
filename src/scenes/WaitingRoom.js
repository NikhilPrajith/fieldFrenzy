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
  }

  create() {
    const scene = this;

    scene.popUp = scene.add.graphics();
    scene.boxes = scene.add.graphics();

    // for popup window
    scene.popUp.fillStyle(0x000000, 0.98);

    // for boxes
    scene.boxes.lineStyle(2, 0xffffff, 1);
    scene.boxes.fillStyle(0x000000, 1);

    // popup window
    scene.popUp.strokeRect(25, 25, 950, 900);
    scene.popUp.fillRect(25, 25, 970, 460);

    //title
    scene.title = scene.add.text(340, 75, "FIELD FRENZY", {
      fill: "#ffffff",
      fontSize: "50px",
      fontStyle: "bold",
    });

    //left popup
    scene.boxes.strokeRoundedRect(420, 150, 170, 60, 10);
    scene.boxes.fillRoundedRect(420, 150, 170, 60, 10);
    scene.requestButton = scene.add.text(455, 155, "Create key", {
      fill: "#ffffff",
      fontSize: "15px",
      fontStyle: "bold",
    });

    //right popup
    scene.boxes.strokeRoundedRect(380, 250, 265, 100, 10);
    scene.boxes.fillRoundedRect(380, 250, 265, 100, 10);
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
    scene.roomKeyText = scene.add.text(487, 180, "", {
      fill: "#ffffff",
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
