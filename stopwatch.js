class Stopwatch {

  constructor() {
    this.banner = null;
    this.interval = null;
    this.restore();
    
    senza.lifecycle.addEventListener("onstatechange", (event) => {
      if (event.state === "background") {
        this.movedToBackground();
      } else if (event.state === "foreground") {
        this.movedToForeground();
      }
    });
    
    this.createBanner();
    this.start();
  }

  restore() {
    this.foreground = parseInt(sessionStorage.getItem("stopwatch/foreground")) || 0;
    this.background = parseInt(sessionStorage.getItem("stopwatch/background")) || 0;
    this.backgroundTime = parseInt(sessionStorage.getItem("stopwatch/backgroundTime")) || 0;
  }
  
  save() {
    sessionStorage.setItem("stopwatch/foreground", `${this.foreground}`);
    sessionStorage.setItem("stopwatch/background", `${this.background}`);
    sessionStorage.setItem("stopwatch/backgroundTime", `${this.backgroundTime}`);
  }

  start() {
    this.updateBanner();
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.foreground++;
      this.updateBanner();
      this.save();
    }, 1000);
  }

  stop() {
    clearInterval(this.interval);
  }

  movedToForeground() {
    if (this.backgroundTime) {
      this.background += Math.ceil((Date.now() - this.backgroundTime) / 1000);
    }
    this.start();
  }

  movedToBackground() {
    this.backgroundTime = Date.now();
    this.stop();
    this.save();
  }

  createBanner() {
    this.banner = document.createElement('div');
    this.banner.style.position = 'fixed';
    this.banner.style.top = '0';
    this.banner.style.left = '0';
    this.banner.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    this.banner.style.color = 'white';
    this.banner.style.fontFamily = 'monospace';
    this.banner.style.fontWeight = '500';
    this.banner.style.fontSize = '24px';
    this.banner.style.padding = '22px';
    this.banner.style.display = 'flex';
    this.banner.style.zIndex = '1000';
    document.body.appendChild(this.banner);
  }

  updateBanner() {
    let ratio = this.foreground ? Math.floor(this.foreground /
      (this.foreground + this.background) * 10000) / 100 : 100;
    this.banner.innerHTML =  `Foreground: ${this.formatTime(this.foreground)}<br>`;
    this.banner.innerHTML += `Background: ${this.formatTime(this.background)}<br>`;
    this.banner.innerHTML += `${'&nbsp;'.repeat(4)} Ratio: ${ratio.toFixed(2)}%`;
  }
  
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return String(hours) + ':' + 
      String(minutes).padStart(2, '0') + ':' + 
      String(secs).padStart(2, '0');
  }
}

