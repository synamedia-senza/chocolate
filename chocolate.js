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
      stepOne();
    }
    
    senza.remotePlayer.addEventListener("ended", () => stepOne());
    senza.alarmManager.addEventListener("stepThree", (e) => stepThree());
    
    senza.uiReady();
  } catch (error) {
    console.error(error);
  }
});

async function stepOne(value = null) {
  if (senza.lifecycle.state != senza.lifecycle.UiState.FOREGROUND) {
    await senza.lifecycle.moveToForeground();
  }
  updateState(value);
  await animateTextIn();
  await sleep(2);
  stepTwo();
}

async function stepTwo() {
  await senza.remotePlayer.unload();
  await senza.lifecycle.moveToBackground();
  senza.alarmManager.addAlarm("stepThree", Date.now() + 10 * 1000);
}

async function stepThree() {
  restoreState();
  await senza.lifecycle.moveToForeground();
  await sleep(2);
  await animateTextOut();
  stepFour();
}

async function stepFour() {
  sessionStorage.clear();
  await playVideo();
  await senza.lifecycle.moveToBackground();
}

document.addEventListener("keydown", async function(event) {
	switch (event.key) {
    case "Escape": stepOne(); break;
    case "Enter": stepFour(); break;
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
  word.innerHTML = value || randomObject(words); 
  
  sessionStorage.setItem("mainStyle", JSON.stringify(mainStyle));
  sessionStorage.setItem("wordValue", word.innerHTML);
}

function applyStyle(mainStyle) { 
  main.style.backgroundColor = mainStyle.backgroundColor;
  main.style.color = mainStyle.color;
  main.style.textShadow = mainStyle.textShadow; 
} 

// returns whether the state was restored
function restoreState() { 
  let mainStyle = JSON.parse(sessionStorage.getItem("mainStyle"));
  let wordValue = sessionStorage.getItem("wordValue");
  if (mainStyle && wordValue) { 
    applyStyle(mainStyle); 
    word.innerHTML = wordValue; 
    return true; 
  } else {
    return false;
  }
}

async function animateTextIn() {
  word.style.animationName = "dissolve-in";
  main.style.animationName = "fade-in";
  
  await sleep(1); // wait one second for the animation to complete
}

async function animateTextOut() {
  word.style.animationName = "dissolve-out";
  main.style.animationName = "fade-out";
  
  await sleep(1); // wait one second for the animation to complete
}

async function playVideo() {
  let url = videoLink + randomNumber(0, 9) + ".mpd";
  console.log("playing", url);
  try {
    await senza.remotePlayer.load(url);
    await senza.remotePlayer.play();
  } catch (e) {
    console.error("error playing", e)
  }
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
