const videoLink = "https://senza-developer.s3.amazonaws.com/streams/chocolate/chocolate";
const textSeconds = 8;
const words = ["chocolate", "delicious", "delightful", "dark", "rich",
  "smooth", "creamy", "velvety", "lovely", "coffee", "mocha"];
const colors = [
  "#7B3F00", // chocolate
  "#513B1C", // milk-chocolate
  "#3F000F", // dark chocolate
  "#EDE6D6", // white chocolate
  "#D2691E", // caramel
];

window.addEventListener("load", async () => {
  try {
    await hs.init();

    updateText("chocolate");
    
    remotePlayer.addEventListener("ended", () => {
      updateText();
      hs.lifecycle.moveToForeground();
    });

    hs.uiReady();
  } catch (error) {
    console.error(error);
  }
});

document.addEventListener("keydown", async function(event) {
	switch (event.key) {
    case "Enter": await playVideo(); break;
    case "Escape": hs.lifecycle.moveToForeground(); updateText(); break;
		default: return;
	}
	event.preventDefault();
});

function updateText(value = null) {
  // get three unique random colors
  let someColors = shuffleArray(colors);
  main.style.backgroundColor = someColors.shift();
  main.style.color = someColors.shift();
  main.style.textShadow = "00px 7px 7px " + someColors.shift();

  word.innerHTML = value || randomObject(words);
  word.style.animationName = "dissolve-in";
  main.style.animationName = "fade-in";
  
  setTimeout(async () => {
    word.style.animationName = "dissolve-out";
    main.style.animationName = "fade-out";
    setTimeout(async () => await playVideo(), 1000);
  }, textSeconds * 1000);
}

async function playVideo() {
  let url = videoLink + randomNumber(0, 9) + ".mpd";
  await hs.remotePlayer.load(url);
  await hs.remotePlayer.play();
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
