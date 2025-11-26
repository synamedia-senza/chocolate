const videoLink = "https://senza-developer.s3.amazonaws.com/streams/chocolate/chocolate";
const words = ["chocolate", "delicious", "delightful", "dark", "rich",
  "smooth", "creamy", "velvety", "lovely", "coffee", "mocha"];
const colors = [
  "#7B3F00", // chocolate
  "#513B1C", // milk-chocolate
  "#3F000F", // dark chocolate
  "#EDE6D6", // white chocolate
  "#D2691E", // caramel
];

let stopwatch;

window.addEventListener("load", async () => {
  try {
    await senza.init();

    stopwatch = new Stopwatch();

    if (senza.lifecycle.connectReason == senza.lifecycle.ConnectReason.INITIAL_CONNECTION) {
      showWord();
    }

    senza.lifecycle.configure({
      autoBackground: {enabled: false}},
      autoSuspend: {enabled: false}}
    });
    senza.remotePlayer.addEventListener("ended", () => showWord());
    senza.alarmManager.addEventListener("hideWord", (e) => hideWord());
    
    senza.uiReady();
  } catch (error) {
    console.error(error);
  }
});

// Step 1
async function showWord(value = null) {
  if (senza.lifecycle.state != senza.lifecycle.UiState.FOREGROUND) {
    await senza.lifecycle.moveToForeground();
  }
  updateState(value);
  word.style.animationName = "dissolve-in";
  main.style.animationName = "fade-in";
  await sleep(3);
  freezeScreen();
}

// Step 2
async function freezeScreen() {
  // work around a bug where remote player is still playing after end of stream
  if (senza.remotePlayer._isPlaying) {
    await senza.remotePlayer.pause();
  }
  await senza.lifecycle.moveToBackground();
  senza.alarmManager.addAlarm("hideWord", Date.now() + 10 * 1000);
}

// Step 3
async function hideWord() {
  restoreState();
  await senza.lifecycle.moveToForeground();
  await sleep(2);
  word.style.animationName = "dissolve-out";
  main.style.animationName = "fade-out";
  await sleep(1);
  playVideo();
}

// Step 4
async function playVideo() {
  let url = videoLink + randomNumber(0, 9) + ".mpd";
  await senza.remotePlayer.load(url);
  await senza.remotePlayer.play();
  await senza.lifecycle.moveToBackground();
}

document.addEventListener("keydown", async function(event) {
	switch (event.key) {
    case "Escape": showWord();break;
    case "Enter": playVideo();break;
		default: return;
	}
	event.preventDefault();
});

async function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function updateState(value = null) { 
  let someColors = shuffleArray(colors);
  let mainStyle = { 
    "backgroundColor": someColors.shift(), 
    "color": someColors.shift(),
    "textShadow": "00px 7px 7px " + someColors.shift() 
  };
  applyStyle(mainStyle);
  sessionStorage.setItem("mainStyle", JSON.stringify(mainStyle));

  word.innerHTML = value || randomObject(words);
  sessionStorage.setItem("wordValue", word.innerHTML);
}

function restoreState() { 
  let mainStyle = JSON.parse(sessionStorage.getItem("mainStyle"));
  if (mainStyle) applyStyle(mainStyle);

  let wordValue = sessionStorage.getItem("wordValue");
  if (wordValue) word.innerHTML = wordValue;
}

function applyStyle(mainStyle) {
  main.style.backgroundColor = mainStyle.backgroundColor;
  main.style.color = mainStyle.color;
  main.style.textShadow = mainStyle.textShadow;
}

function shuffleArray(array) {
  const newArray = array.slice();
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomObject(array) {
  if (array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}
