/* =========================
   Vending Machine DFA (Web)
   - QR Simulation via Node backend
   - Cash drag & drop ($1 coins)
   - Polling for QR payment status
   ========================= */

// -------------------- Sound System --------------------
const SoundFX = (() => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  function playTone(frequency, duration, type = 'sine', volume = 0.1) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.value = volume;
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }
  
  return {
    select: () => playTone(800, 0.1, 'sine', 0.08),
    yes: () => playTone(1000, 0.15, 'sine', 0.1),
    no: () => playTone(400, 0.2, 'sine', 0.08),
    coin: () => {
      playTone(1200, 0.05, 'sine', 0.12);
      setTimeout(() => playTone(900, 0.05, 'sine', 0.1), 50);
    },
    success: () => {
      playTone(800, 0.1, 'sine', 0.1);
      setTimeout(() => playTone(1000, 0.1, 'sine', 0.1), 100);
      setTimeout(() => playTone(1200, 0.2, 'sine', 0.12), 200);
    },
    cancel: () => {
      playTone(600, 0.1, 'square', 0.08);
      setTimeout(() => playTone(400, 0.15, 'square', 0.08), 100);
    },
    dispense: () => {
      playTone(500, 0.15, 'sawtooth', 0.1);
      setTimeout(() => playTone(450, 0.15, 'sawtooth', 0.1), 150);
    },
    doorOpen: () => playTone(1500, 0.1, 'triangle', 0.08),
    take: () => playTone(1200, 0.15, 'sine', 0.1)
  };
})();

// -------------------- State Panel Manager --------------------
const StatePanel = (() => {
  const transitionHistory = [];
  const maxHistory = 10;
  
  function updateState(state) {
    const el = document.getElementById('panelState');
    if (el) el.textContent = state;
  }
  
  function updateLastSymbol(symbol) {
    const el = document.getElementById('panelLastSymbol');
    if (el) el.textContent = symbol || '-';
  }
  
  function updateSelection(drink) {
    const section = document.getElementById('panelSelectionSection');
    const name = document.getElementById('panelDrinkName');
    const price = document.getElementById('panelPrice');
    
    if (drink) {
      if (section) section.style.display = 'block';
      if (name) name.textContent = drink.name;
      if (price) price.textContent = `$${drink.price.toFixed(2)}`;
    } else {
      if (section) section.style.display = 'none';
    }
  }
  
  function updatePayment(paid, remaining, price) {
    const section = document.getElementById('panelPaymentSection');
    const paidEl = document.getElementById('panelPaid');
    const remainingEl = document.getElementById('panelRemaining');
    
    if (paid > 0 || remaining > 0) {
      if (section) section.style.display = 'block';
      if (paidEl) paidEl.textContent = `$${paid.toFixed(2)}`;
      if (remainingEl) remainingEl.textContent = `$${remaining.toFixed(2)}`;
    } else {
      if (section) section.style.display = 'none';
    }
  }
  
  function updateChange(change) {
    const section = document.getElementById('panelChangeSection');
    const changeEl = document.getElementById('panelChange');
    
    if (change > 0) {
      if (section) section.style.display = 'block';
      if (changeEl) changeEl.textContent = `$${change.toFixed(2)}`;
    } else {
      if (section) section.style.display = 'none';
    }
  }
  
  function addTransition(from, symbol, to) {
    transitionHistory.push({ from, symbol, to, time: new Date().toLocaleTimeString() });
    if (transitionHistory.length > maxHistory) {
      transitionHistory.shift();
    }
    renderTransitionLog();
  }
  
  function renderTransitionLog() {
    const log = document.getElementById('transitionLog');
    if (!log) return;
    
    log.innerHTML = transitionHistory
      .slice()
      .reverse()
      .map(t => `<div>${t.time}: ${t.from} --${t.symbol}--> ${t.to}</div>`)
      .join('');
  }
  
  function reset() {
    updateSelection(null);
    updatePayment(0, 0, 0);
    updateChange(0);
  }
  
  return {
    updateState,
    updateLastSymbol,
    updateSelection,
    updatePayment,
    updateChange,
    addTransition,
    reset
  };
})();

// -------------------- Drinks Data (frontend copy) --------------------
// This is for showing selection info quickly.
// Real stock is enforced by backend at /api/payments create + /pay/:id/confirm.
const drinks = [
  { id: 1.1, name: "Ramune Original Flavor", tem: "cold", price: 2 },
  { id: 1.2, name: "Ramune Original Flavor", tem: "cold", price: 2 },
  { id: 1.3, name: "Ramune Mango & Pineapple", tem: "cold", price: 3 },
  { id: 1.4, name: "Calpico Strawberry Flavor", tem: "cold", price: 2.5 },
  { id: 1.5, name: "Calpico Original Flavor", tem: "cold", price: 2.5 },
  { id: 1.6, name: "Relax Milk Tea", tem: "cold", price: 3 },
  { id: 1.7, name: "Sparkling Water Peach Flavor", tem: "cold", price: 2 },
  { id: 1.8, name: "Oolong Tea Peach Flavor", tem: "cold", price: 2 },

  { id: 2.1, name: "Royal Milk Tea", tem: "cold", price: 2 },
  { id: 2.2, name: "Wangzai Milk", tem: "cold", price: 2 },
  { id: 2.3, name: "Plum Drink", tem: "cold", price: 3 },
  { id: 2.4, name: "Grape Cocktail (Non-alcoholic)", tem: "cold", price: 2.5 },
  { id: 2.5, name: "Orange Cocktail (Non-alcoholic)", tem: "cold", price: 2.5 },
  { id: 2.6, name: "Nectar Peach Juice", tem: "cold", price: 3 },
  { id: 2.7, name: "Cafe Latte Caramel", tem: "cold", price: 2 },
  { id: 2.8, name: "DemiSoda Peach Flavor", tem: "cold", price: 2 },

  { id: 3.1, name: "Royal Milk Tea", tem: "cold", price: 2 },
  { id: 3.2, name: "Wangzai Milk", tem: "cold", price: 2 },
  { id: 3.3, name: "Plum Drink", tem: "cold", price: 3 },
  { id: 3.4, name: "Grape Cocktail (Non-alcoholic)", tem: "cold", price: 2.5 },
  { id: 3.5, name: "Apple Juice", tem: "cold", price: 2.5 },
  { id: 3.6, name: "Nectar Peach Juice", tem: "cold", price: 3 },
  { id: 3.7, name: "Jeju Matcha Latte", tem: "cold", price: 2 },
  { id: 3.8, name: "DemiSoda Grapefruit Flavor", tem: "cold", price: 2 }
];

function findDrinkByBtnId(btnIdStr) {
  const idNum = Number(btnIdStr);
  return drinks.find(d => Number(d.id) === idNum) || null;
}

// -------------------- DFA Definitions --------------------
// States: Q0 through Q9 as specified in instructions.json
const State = Object.freeze({
  Q0_IDLE: "Q0_IDLE",
  Q1_CONFIRM_SELECTION: "Q1_CONFIRM_SELECTION",
  Q2_CHOOSE_PAYMENT: "Q2_CHOOSE_PAYMENT",
  Q3_CASH_INSERTION: "Q3_CASH_INSERTION",
  Q4_QR_PENDING: "Q4_QR_PENDING",
  Q5_RETURN_CHANGE: "Q5_RETURN_CHANGE",
  Q6_PAYMENT_CONFIRMED: "Q6_PAYMENT_CONFIRMED",
  Q7_DISPENSING: "Q7_DISPENSING",
  Q8_COLLECT_ITEM: "Q8_COLLECT_ITEM",
  Q9_REFUND: "Q9_REFUND"
});

// Symbols (Sigma): All DFA input events as specified in instructions.json
const Symbol = Object.freeze({
  select: "select",
  yes: "yes",
  no: "no",
  cash: "cash",
  QR: "QR",
  coin: "coin",
  enough: "enough",
  over: "over",
  refundDone: "refundDone",
  qrOk: "qrOk",
  qrFail: "qrFail",
  cancel: "cancel",
  timeout: "timeout",
  dispense: "dispense",
  dispenseDone: "dispenseDone",
  openBox: "openBox",
  take: "take",
  soldOut: "soldOut",
  noChange: "noChange"
});

// Transition table (delta): Exactly matches the DFA specification in instructions.json
const delta = {
  [State.Q0_IDLE]: {
    [Symbol.select]: State.Q1_CONFIRM_SELECTION
  },

  [State.Q1_CONFIRM_SELECTION]: {
    [Symbol.yes]: State.Q2_CHOOSE_PAYMENT,
    [Symbol.no]: State.Q0_IDLE,
    [Symbol.soldOut]: State.Q0_IDLE
  },

  [State.Q2_CHOOSE_PAYMENT]: {
    [Symbol.cash]: State.Q3_CASH_INSERTION,
    [Symbol.QR]: State.Q4_QR_PENDING,
    [Symbol.cancel]: State.Q0_IDLE,
    [Symbol.timeout]: State.Q0_IDLE
  },

  [State.Q3_CASH_INSERTION]: {
    [Symbol.coin]: State.Q3_CASH_INSERTION,
    [Symbol.enough]: State.Q6_PAYMENT_CONFIRMED,
    [Symbol.over]: State.Q5_RETURN_CHANGE,
    [Symbol.cancel]: State.Q9_REFUND,
    [Symbol.timeout]: State.Q9_REFUND
  },

  [State.Q4_QR_PENDING]: {
    [Symbol.qrOk]: State.Q6_PAYMENT_CONFIRMED,
    [Symbol.qrFail]: State.Q2_CHOOSE_PAYMENT,
    [Symbol.cancel]: State.Q0_IDLE,
    [Symbol.timeout]: State.Q0_IDLE
  },

  [State.Q5_RETURN_CHANGE]: {
    [Symbol.refundDone]: State.Q6_PAYMENT_CONFIRMED,
    [Symbol.noChange]: State.Q9_REFUND
  },

  [State.Q6_PAYMENT_CONFIRMED]: {
    [Symbol.dispense]: State.Q7_DISPENSING
  },

  [State.Q7_DISPENSING]: {
    [Symbol.dispenseDone]: State.Q8_COLLECT_ITEM
  },

  [State.Q8_COLLECT_ITEM]: {
    [Symbol.openBox]: State.Q8_COLLECT_ITEM,
    [Symbol.take]: State.Q0_IDLE
  },

  [State.Q9_REFUND]: {
    [Symbol.refundDone]: State.Q0_IDLE
  }
};

// -------------------- UI Helpers --------------------
const UI = (() => {
  const messageBox = document.getElementById("message");

  function pEl() {
    return messageBox ? messageBox.querySelector("p") : null;
  }

  function setMsg(text) {
    const p = pEl();
    if (!p) return;
    p.textContent = text;
    p.style.whiteSpace = "pre-line";
  }

  function screenImgEl() {
    if (!messageBox) return null;
    const imgs = messageBox.getElementsByTagName("img");
    return imgs && imgs[0] ? imgs[0] : null;
  }

  function setScreen(src) {
    const img = screenImgEl();
    if (img) {
      img.src = src;
      // بس QR code يكون فوق كل شي، الرسائل العادية عادي
      if (src && src.includes("/api/qr/")) {
        img.style.zIndex = "999";
      } else {
        img.style.zIndex = "1";
      }
    }
  }

  function clearButtons() {
    if (!messageBox) return;
    messageBox.querySelectorAll("button").forEach(b => b.remove());
  }

  function addConfirmButtons(onYes, onNo) {
    clearButtons();

    const yes = document.createElement("button");
    const no = document.createElement("button");

    yes.textContent = "YES";
    yes.className = "btn btn-primary btn-sm";
    yes.type = "button";
    yes.style.width = "25px";
    yes.style.height = "15px";
    yes.style.fontSize = "6px";
    yes.style.position = "relative";
    yes.style.left = "25px";
    yes.style.zIndex = "3";
    yes.onclick = onYes;

    no.textContent = "NO";
    no.className = "btn btn-light btn-sm";
    no.type = "button";
    no.style.width = "25px";
    no.style.height = "15px";
    no.style.fontSize = "6px";
    no.style.position = "relative";
    no.style.left = "35px";
    no.style.zIndex = "3";
    no.onclick = onNo;

    messageBox.appendChild(yes);
    messageBox.appendChild(no);
  }

  function addPayButtons(onQR, onCash, onExit) {
    clearButtons();

    const btnQR = document.createElement("button");
    btnQR.type = "button";
    btnQR.className = "btn btn-light";
    btnQR.style.width = "25px";
    btnQR.style.height = "50px";
    btnQR.style.position = "absolute";
    btnQR.style.left = "40px";
    btnQR.style.top = "80px";
    btnQR.style.zIndex = "3";
    btnQR.style.fontSize = "9px";
    btnQR.textContent = "QR";
    btnQR.onclick = onQR;

    const btnCash = document.createElement("button");
    btnCash.type = "button";
    btnCash.className = "btn btn-light";
    btnCash.style.width = "25px";
    btnCash.style.height = "50px";
    btnCash.style.position = "absolute";
    btnCash.style.left = "75px";
    btnCash.style.top = "80px";
    btnCash.style.zIndex = "3";
    btnCash.style.fontSize = "8px";
    btnCash.textContent = "CASH";
    btnCash.onclick = onCash;

    const exit = document.createElement("button");
    exit.type = "button";
    exit.className = "btn btn-info btn-sm";
    exit.textContent = "X";
    exit.style.fontSize = "6px";
    exit.style.position = "absolute";
    exit.style.left = "62px";
    exit.style.top = "135px";
    exit.style.zIndex = "3";
    exit.onclick = onExit;

    messageBox.appendChild(btnQR);
    messageBox.appendChild(btnCash);
    messageBox.appendChild(exit);
  }

  function addCancelButton(onCancel) {
    removeCancelButton();
    
    const machineBody = document.getElementById('machinebody');
    if (!machineBody) return;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'globalCancelBtn';
    cancelBtn.className = 'cancel-button';
    cancelBtn.textContent = '✖ CANCEL';
    cancelBtn.onclick = onCancel;
    
    machineBody.appendChild(cancelBtn);
  }
  
  function removeCancelButton() {
    const btn = document.getElementById('globalCancelBtn');
    if (btn) btn.remove();
  }

  function renderLoader() {
    const oldLoader = messageBox ? messageBox.querySelector(".loader") : null;
    if (oldLoader) oldLoader.remove();
    const oldTick = document.getElementById("tick");
    if (oldTick) oldTick.remove();

    const loader = document.createElement("div");
    loader.className = "loader";
    messageBox.appendChild(loader);
  }

  function renderTickThenSmile() {
    const oldLoader = messageBox ? messageBox.querySelector(".loader") : null;
    if (oldLoader) oldLoader.remove();

    const tick = document.createElement("img");
    tick.id = "tick";
    tick.src = "https://assets.codepen.io/4977637/iconfinder_Tick_Mark_Dark_1398912.png";
    tick.style.width = "30px";
    tick.style.height = "40px";
    tick.style.position = "relative";
    tick.style.bottom = "50px";
    tick.style.left = "40px";
    tick.style.zIndex = "5";
    messageBox.appendChild(tick);

    setTimeout(() => {
      tick.src = "https://assets.codepen.io/4977637/iconfinder_smile_emoticon_emoticons_emoji_emote_1_2993617.png";
    }, 1200);
  }

  function flashGreenButton(drinkId) {
    const btn = document.getElementById(String(drinkId));
    if (!btn) return;
    btn.src = "https://assets.codepen.io/4977637/buttongreen.png";
    setTimeout(() => {
      btn.src = "https://assets.codepen.io/4977637/button.png";
    }, 1200);
  }

  function dropDrink(drinkId) {
    const originIcon = document.getElementById(String(drinkId) + ".1");
    if (!originIcon) return;

    const origin = originIcon.parentElement;
    const drink = document.createElement("img");
    drink.src = originIcon.src;
    drink.style.width = originIcon.style.width;
    drink.style.height = originIcon.style.height;
    drink.style.position = "absolute";
    drink.style.zIndex = "8";
    drink.id = String(drinkId) + ".1.2";

    let numb = drink.style.width.match(/\d/g);
    numb = numb ? numb.join("") : "30";
    drink.style.right = (Number(numb) / 2) + "px";

    origin.appendChild(drink);

    let pos = 0;
    const dInt = parseInt(drinkId);
    const limit = dInt < 2 ? 480 : (dInt < 3 ? 280 : 200);

    const timer = setInterval(() => {
      if (pos >= limit) {
        clearInterval(timer);
      } else {
        pos++;
        drink.style.top = pos + "px";
      }
    }, 3);
  }

  function spawnDrinkAtDoor(drinkId, onTake) {
    const door = document.getElementById("getdrink");
    const cover = document.getElementById("cover");
    if (!door || !cover) return;

    const existing = document.getElementById("myDrink");
    if (existing) existing.remove();

    const originIcon = document.getElementById(String(drinkId) + ".1");
    if (!originIcon) return;

    const drink = document.createElement("img");
    drink.src = originIcon.src;
    drink.style.width = originIcon.style.width;
    drink.style.height = originIcon.style.height;
    drink.style.position = "absolute";
    drink.style.bottom = "26px";
    drink.style.left = "100px";
    drink.style.zIndex = "10"; // فوق الغطاء (cover z-index = 9)
    drink.id = "myDrink";
    drink.onclick = onTake;

    door.appendChild(drink);

    cover.onclick = null;
  }

  function resetDoorCover() {
    const door = document.getElementById("getdrink");
    if (!door) return;

    const myDrink = document.getElementById("myDrink");
    if (myDrink) myDrink.remove();

    if (!document.getElementById("cover")) {
      const cover = document.createElement("img");
      cover.src = "https://assets.codepen.io/4977637/getdrink2.png";
      cover.style.width = "300px";
      cover.style.position = "absolute";
      cover.style.bottom = "40px";
      cover.id = "cover";
      cover.style.zIndex = "9";
      door.appendChild(cover);
    }

    const tick = document.getElementById("tick");
    if (tick) tick.remove();

    setTimeout(() => {
      setScreen("https://assets.codepen.io/4977637/greyinterface.png");
    }, 800);
  }

  return {
    setMsg,
    setScreen,
    clearButtons,
    addConfirmButtons,
    addPayButtons,
    addCancelButton,
    removeCancelButton,
    renderLoader,
    renderTickThenSmile,
    flashGreenButton,
    dropDrink,
    spawnDrinkAtDoor,
    resetDoorCover,
  };
})();

// -------------------- Cash Drag & Drop Init --------------------
(function initCashDragDrop() {
  const coinsBox = document.getElementById("coinsBox");
  const tray = document.getElementById("coinTray");
  const slot = document.getElementById("cashSlot");
  const paymentStatus = document.getElementById("paymentStatus");

  // Display elements
  const displayPrice = document.getElementById("displayPrice");
  const displayPaid = document.getElementById("displayPaid");
  const displayRemaining = document.getElementById("displayRemaining");
  const sidePrice = document.getElementById("sidePrice");
  const sidePaid = document.getElementById("sidePaid");
  const sideRemaining = document.getElementById("sideRemaining");

  if (!coinsBox || !tray || !slot) return;

  let draggedValue = 0;
  let draggedEl = null;

  // Drag start from coin tray
  tray.addEventListener("dragstart", (e) => {
    const coin = e.target.closest(".coin");
    if (!coin) return;

    draggedValue = Number(coin.dataset.value || 1);
    draggedEl = coin;
    coin.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(draggedValue));
  });

  tray.addEventListener("dragend", (e) => {
    const coin = e.target.closest(".coin");
    if (coin) coin.classList.remove("dragging");
  });

  // Drag over slot
  slot.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    slot.classList.add("drag-over");
  });

  slot.addEventListener("dragleave", () => {
    slot.classList.remove("drag-over");
  });

  // Drop on slot
  slot.addEventListener("drop", (e) => {
    e.preventDefault();
    slot.classList.remove("drag-over");

    if (!window.dfa || !dfa.selected) return;
    if (dfa.state !== State.Q3_CASH_INSERTION) return;

    // Add to paidAmount and track in insertedCoins (Option 2: temporary transaction pool)
    dfa.paidAmount += draggedValue;
    if (dfa.insertedCoins[draggedValue] !== undefined) {
      dfa.insertedCoins[draggedValue]++;
    }

    // Reset timeout on coin drop (user activity)
    TimeoutManager.reset(() => {
      console.log("⏰ Timeout in Q3_CASH_INSERTION");
      dfa.step(Symbol.timeout);
    });

    // Remove coin from tray with animation
    if (draggedEl) {
      draggedEl.style.transition = "all 0.3s ease-out";
      draggedEl.style.opacity = "0";
      draggedEl.style.transform = "scale(0) translateY(20px)";
      setTimeout(() => draggedEl.remove(), 300);
    }

    // Update all displays
    const price = Number(dfa.selected.price);
    const remaining = Math.max(0, price - dfa.paidAmount);

    updateDisplays(price, dfa.paidAmount, remaining);

    // Play sound
    playSuccessSound();

    // Trigger DFA transition based on payment status
    if (dfa.paidAmount > price) {
      // Overpayment: go to Q5 to return change
      setTimeout(() => {
        if (dfa.state === State.Q3_CASH_INSERTION) {
          CashUI.hide();
          dfa.step(Symbol.over);
        }
      }, 800);
    } else if (dfa.paidAmount === price) {
      // Exact payment: go to Q6
      setTimeout(() => {
        if (dfa.state === State.Q3_CASH_INSERTION) {
          CashUI.hide();
          dfa.step(Symbol.enough);
        }
      }, 800);
    } else {
      // Partial payment: stay in Q3, trigger coin symbol
      dfa.step(Symbol.coin);
    }

    draggedValue = 0;
    draggedEl = null;
  });

  function updateDisplays(price, paid, remaining) {
    const priceStr = `$${price.toFixed(1)}`;
    const paidStr = `$${paid.toFixed(1)}`;
    const remainingStr = `$${remaining.toFixed(1)}`;

    if (displayPrice) displayPrice.textContent = priceStr;
    if (displayPaid) displayPaid.textContent = paidStr;
    if (displayRemaining) displayRemaining.textContent = remainingStr;
    if (sidePrice) sidePrice.textContent = priceStr;
    if (sidePaid) sidePaid.textContent = paidStr;
    if (sideRemaining) sideRemaining.textContent = remainingStr;

    // Change color based on status
    if (displayRemaining) {
      displayRemaining.style.color = remaining === 0 ? "#27ae60" : "#e74c3c";
    }
  }

  function playSuccessSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Silently fail
    }
  }

  window.CashUI = {
    show(price) {
      console.log("CashUI.show called with price:", price);
      console.log("coinsBox element:", coinsBox);
      console.log("tray element:", tray);

      dfa.paidAmount = 0;

      // Update displays
      updateDisplays(price, 0, price);

      // Reset and show tray
      this.resetTray();

      // Show UI elements
      if (coinsBox) {
        coinsBox.classList.add("show");
        console.log("Added 'show' class to coinsBox");
      }
      if (slot) {
        slot.classList.add("show");
        console.log("Added 'show' class to slot");
      }
      if (paymentStatus) {
        paymentStatus.classList.add("show");
        console.log("Added 'show' class to paymentStatus");
      }

      // Log tray coins count
      console.log("Coins in tray:", tray.children.length);
    },

    hide() {
      coinsBox.classList.remove("show");
      slot.classList.remove("show");
      paymentStatus.classList.remove("show");
    },

    resetTray() {
      console.log("resetTray called");
      const coinValues = [1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.25, 0.25];
      tray.innerHTML = "";

      coinValues.forEach((value, index) => {
        const coin = document.createElement("div");
        coin.className = "coin";
        coin.draggable = true;
        coin.dataset.value = value;
        coin.textContent = `$${value}`;
        coin.style.animation = `fadeIn 0.3s ease-out ${index * 0.05}s both`;
        tray.appendChild(coin);
        console.log(`Added coin: $${value}`);
      });

      console.log("Total coins added:", tray.children.length);
    },

    showRefundCoins(amount, message, onCollect) {
      // Clear tray and show refund coins
      tray.innerHTML = "";

      // Calculate coins to return
      let remaining = amount;
      const coinValues = [1, 0.5, 0.25];
      const coinsToReturn = [];

      for (const value of coinValues) {
        while (remaining >= value - 0.01) { // -0.01 for floating point tolerance
          coinsToReturn.push(value);
          remaining -= value;
        }
      }

      // Display coins with animation
      coinsToReturn.forEach((value, index) => {
        const coin = document.createElement("div");
        coin.className = "coin refund-coin";
        coin.dataset.value = value;
        coin.textContent = `$${value}`;
        coin.style.animation = `fadeIn 0.3s ease-out ${index * 0.05}s both`;
        coin.style.cursor = "pointer";
        coin.style.background = "linear-gradient(135deg, #f6d365 0%, #fda085 100%)";
        tray.appendChild(coin);
      });

      // Show coins box with refund message
      coinsBox.classList.add("show");
      slot.classList.remove("show");
      paymentStatus.classList.remove("show");

      // Add "Collect Money" button
      const existingBtn = tray.querySelector(".collect-btn");
      if (existingBtn) existingBtn.remove();

      const collectBtn = document.createElement("button");
      collectBtn.className = "collect-btn";
      collectBtn.textContent = "خذ المصاري - Collect";
      collectBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        margin-top: 15px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
      `;

      collectBtn.onmouseover = () => {
        collectBtn.style.transform = "scale(1.05)";
        collectBtn.style.boxShadow = "0 5px 15px rgba(102, 126, 234, 0.4)";
      };

      collectBtn.onmouseout = () => {
        collectBtn.style.transform = "scale(1)";
        collectBtn.style.boxShadow = "none";
      };

      collectBtn.onclick = () => {
        // Animate coins collection
        const coins = tray.querySelectorAll(".refund-coin");
        coins.forEach((coin, index) => {
          setTimeout(() => {
            coin.style.transition = "all 0.4s ease-out";
            coin.style.opacity = "0";
            coin.style.transform = "translateY(-30px) scale(0.5)";
          }, index * 50);
        });

        // Hide coins box and trigger callback
        setTimeout(() => {
          this.hide();
          if (onCollect) onCollect();
        }, coins.length * 50 + 400);
      };

      tray.appendChild(collectBtn);
    }
  };

  // Global function for canceling (can be called from UI if needed)
  window.cancelCashPayment = function () {
    if (window.dfa) {
      dfa.paidAmount = 0;
      CashUI.hide();
      dfa.clearSelectionVisual();
      dfa.step(Symbol.cancel);
    }
  };
})();


// -------------------- Timeout Manager --------------------
const TimeoutManager = (() => {
  let timeoutId = null;
  const TIMEOUT_DURATION_MS = 30000; // 30 seconds

  function start(callback) {
    stop(); // Clear any existing timeout
    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback();
    }, TIMEOUT_DURATION_MS);
  }

  function reset(callback) {
    if (timeoutId !== null) {
      start(callback); // Restart the timer
    }
  }

  function stop() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function isActive() {
    return timeoutId !== null;
  }

  return { start, reset, stop, isActive };
})();

// -------------------- DFA Engine --------------------
/*
 * CASH CHANGE - Option 2:
 * - coinInventory: Machine's preloaded change (persistent across transactions)
 * - insertedCoins: Coins inserted in CURRENT transaction only (temporary)
 * - On successful change: commit insertedCoins to coinInventory
 * - On refund/cancel: return insertedCoins to user, coinInventory unchanged
 */
class VendingDFA {
  constructor() {
    this.state = State.Q0_IDLE;
    this.selected = null;
    this.paidAmount = 0; // Track amount paid in cash
    this.change = 0; // Track change to return
    
    // Option 2: Separate coin management
    this.coinInventory = { 1: 10, 0.5: 0, 0.25: 0 }; // Machine's persistent change reserve
    this.insertedCoins = { 1: 0, 0.5: 0, 0.25: 0 };  // Temporary coins from current transaction

    this.paymentId = null;
    this.pollTimer = null;

    this.processingLock = false;
    this.render();
  }

  can(symbol) {
    return !!(delta[this.state] && delta[this.state][symbol]);
  }

  step(symbol) {
    const next = delta[this.state] && delta[this.state][symbol];
    if (!next) {
      console.warn(`❌ Invalid transition: ${this.state} + ${symbol}`);
      this.render(`\n⚠️ Invalid transition from ${this.state} with ${symbol}`);
      return;
    }

    console.log(`DFA: ${this.state} + ${symbol} → ${next}`);
    
    // Update state panel
    StatePanel.addTransition(this.state, symbol, next);
    StatePanel.updateLastSymbol(symbol);
    
    // Play sounds based on symbol
    if (symbol === Symbol.select) SoundFX.select();
    else if (symbol === Symbol.yes) SoundFX.yes();
    else if (symbol === Symbol.no) SoundFX.no();
    else if (symbol === Symbol.coin) SoundFX.coin();
    else if (symbol === Symbol.cancel) SoundFX.cancel();
    else if (symbol === Symbol.qrOk) SoundFX.success();
    else if (symbol === Symbol.dispense) SoundFX.dispense();
    else if (symbol === Symbol.openBox) SoundFX.doorOpen();
    else if (symbol === Symbol.take) SoundFX.take();
    
    this.state = next;
    this.render();
    this.onStateEntered();
  }

  render(extra = "") {
    const d = this.selected;
    
    // Update State Panel
    StatePanel.updateState(this.state);
    StatePanel.updateSelection(d);
    
    const price = d ? Number(d.price) : 0;
    const remaining = price - this.paidAmount;
    StatePanel.updatePayment(this.paidAmount, remaining > 0 ? remaining : 0, price);
    StatePanel.updateChange(this.change);
    
    // Clear old HUD (if it exists)
    const hudState = document.getElementById("hudState");
    const hudSelection = document.getElementById("hudSelection");
    const hudDrinkName = document.getElementById("hudDrinkName");
    const hudPrice = document.getElementById("hudPrice");
    const hudDrinkPrice = document.getElementById("hudDrinkPrice");
    const hudExtra = document.getElementById("hudExtra");
    
    if (hudState) {
      hudState.textContent = this.state;
    }
    
    if (d) {
      if (hudSelection) hudSelection.style.display = "flex";
      if (hudDrinkName) hudDrinkName.textContent = d.name;
      if (hudPrice) hudPrice.style.display = "flex";
      if (hudDrinkPrice) hudDrinkPrice.textContent = `$${d.price}`;
    } else {
      if (hudSelection) hudSelection.style.display = "none";
      if (hudPrice) hudPrice.style.display = "none";
    }
    
    if (hudExtra) {
      hudExtra.textContent = extra;
    }

    // DON'T clear messages - let them persist until explicitly changed
    // Only set message if extra is provided
    if (extra) {
      UI.setMsg(extra);
    }

    // Only certain states show white interface
    const whiteInterfaceStates = [State.Q1_CONFIRM_SELECTION, State.Q2_CHOOSE_PAYMENT, State.Q3_CASH_INSERTION, State.Q4_QR_PENDING];
    if (!whiteInterfaceStates.includes(this.state)) {
      UI.setScreen("https://assets.codepen.io/4977637/greyinterface.png");
    }
  }

  cleanupAsync() {
    // Stop polling timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Stop timeout timer
    TimeoutManager.stop();

    // Reset payment data
    this.paymentId = null;
    this.paidAmount = 0;
    this.change = 0;

    // Hide cash UI
    if (window.CashUI) CashUI.hide();
    
    // Remove cancel button
    UI.removeCancelButton();
  }

  onStateEntered() {
    // Q0_IDLE: Reset everything
    if (this.state === State.Q0_IDLE) {
      this.cleanupAsync();
      UI.clearButtons();
      UI.resetDoorCover();
      UI.setMsg(""); // Clear message in idle state
      StatePanel.reset();
      this.selected = null;
      this.paidAmount = 0;
      this.change = 0;
      this.insertedCoins = { 1: 0, 0.5: 0, 0.25: 0 }; // Reset transaction coins
      return;
    }

    // Q1_CONFIRM_SELECTION: Show YES/NO buttons, check for SOLD OUT
    if (this.state === State.Q1_CONFIRM_SELECTION) {
      UI.setMsg("Confirm selection?\nPress YES or NO");
      
      // Check stock immediately on entering Q1
      if (this.selected) {
        // Fetch current stock from backend
        fetch(`/api/stock/${this.selected.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.stock <= 0) {
              // SOLD OUT: trigger soldOut symbol
              UI.setMsg(`❌ SOLD OUT\n\n${this.selected.name}\nis not available`);
              setTimeout(() => {
                this.clearSelectionVisual();
                this.step(Symbol.soldOut);
              }, 1500);
            }
          })
          .catch(err => console.error("Failed to check stock:", err));
      }

      UI.setScreen("https://assets.codepen.io/4977637/whiteinterface.png");
      UI.addConfirmButtons(
        () => this.step(Symbol.yes),
        () => {
          this.clearSelectionVisual();
          this.step(Symbol.no);
        }
      );
      return;
    }

    // Q2_CHOOSE_PAYMENT: Show QR/CASH/Cancel buttons, start timeout
    if (this.state === State.Q2_CHOOSE_PAYMENT) {
      UI.setMsg("Choose payment:\nQR or CASH");
      UI.setScreen("https://assets.codepen.io/4977637/whiteinterface.png");
      UI.addPayButtons(
        () => this.payByQR(),
        () => this.payByCash(),
        () => {
          this.clearSelectionVisual();
          this.step(Symbol.cancel);
        }
      );
      
      // Add cancel button on machine body
      UI.addCancelButton(() => {
        this.clearSelectionVisual();
        this.step(Symbol.cancel);
      });

      // Start timeout for Q2
      TimeoutManager.start(() => {
        console.log("⏰ Timeout in Q2_CHOOSE_PAYMENT");
        this.step(Symbol.timeout);
      });
      return;
    }

    // Q3_CASH_INSERTION: Enable coin drops, start timeout
    if (this.state === State.Q3_CASH_INSERTION) {
      UI.setMsg("Insert coins\nDrag coins from\nwallet to slot");
      
      // Cash UI is shown by payByCash method
      
      // Add cancel button on machine body
      UI.addCancelButton(() => {
        this.clearSelectionVisual();
        this.step(Symbol.cancel);
      });
      
      // Start timeout for Q3
      TimeoutManager.start(() => {
        console.log("⏰ Timeout in Q3_CASH_INSERTION");
        this.step(Symbol.timeout);
      });
      return;
    }

    // Q4_QR_PENDING: Handled by payByQR method (creates QR, starts polling, starts timeout)
    if (this.state === State.Q4_QR_PENDING) {
      // QR creation and polling is initiated by payByQR
      
      // Add cancel button on machine body
      UI.addCancelButton(() => {
        this.cleanupAsync();
        this.step(Symbol.cancel);
      });
      
      return;
    }

    // Q5_RETURN_CHANGE: Calculate change using Option 2 (coinInventory + insertedCoins)
    if (this.state === State.Q5_RETURN_CHANGE) {
      const price = Number(this.selected.price);
      const changeRequired = this.paidAmount - price;

      UI.clearButtons();

      // Combine coinInventory + insertedCoins for change-making
      const availableCoins = {
        1: this.coinInventory[1] + this.insertedCoins[1],
        0.5: this.coinInventory[0.5] + this.insertedCoins[0.5],
        0.25: this.coinInventory[0.25] + this.insertedCoins[0.25]
      };

      // Try to make change
      const changePlan = this.makeChange(changeRequired, availableCoins);

      if (changePlan) {
        // Change CAN be made
        this.change = changeRequired;

        // Apply change plan: consume coins from insertedCoins first, then coinInventory
        this.applyChangePlan(changePlan);

        // Commit remaining insertedCoins to coinInventory (transaction successful)
        this.commitInsertedCoins();

        const invStr = JSON.stringify(this.coinInventory);
        UI.setMsg(
          `Current State:\n${this.state}\n\n💵 Returning Change:\n$${this.change.toFixed(2)}\n(Inventory: ${invStr})\n\nPlease take your change...`
        );

        // Show change coins in the coins box
        if (window.CashUI && this.change > 0) {
          CashUI.showRefundCoins(
            this.change,
            `💵 Change: $${this.change.toFixed(2)}`,
            () => {
              console.log("Change collected");
              this.step(Symbol.refundDone);
            }
          );
        } else {
          setTimeout(() => {
            this.step(Symbol.refundDone);
          }, 1000);
        }
      } else {
        // Change CANNOT be made: full refund via Q9
        const invStr = JSON.stringify(this.coinInventory);
        const insStr = JSON.stringify(this.insertedCoins);
        UI.setMsg(
          `Current State:\n${this.state}\n\n⚠️ NO CHANGE AVAILABLE\n(Need: $${changeRequired.toFixed(2)})\nInventory: ${invStr}\nInserted: ${insStr}\n\nReturning full amount...`
        );

        setTimeout(() => {
          this.step(Symbol.noChange);
        }, 2000);
      }
      return;
    }

    // Q6_PAYMENT_CONFIRMED: Auto-transition to dispensing
    if (this.state === State.Q6_PAYMENT_CONFIRMED) {
      UI.clearButtons();
      UI.setMsg(
        `Current State:\n${this.state}\n\n✅ Payment Confirmed!\nPreparing your drink...`
      );

      // Auto-transition to dispensing
      setTimeout(() => {
        this.step(Symbol.dispense);
      }, 800);
      return;
    }

    // Q7_DISPENSING: Run dispensing animation, decrement stock for CASH purchases, then auto-transition to Q8
    if (this.state === State.Q7_DISPENSING) {
      UI.clearButtons();
      UI.renderTickThenSmile();
      UI.flashGreenButton(this.selected.id);
      UI.dropDrink(this.selected.id);

      // Decrement stock for CASH purchases (QR already decremented in /pay/:id/confirm)
      // Only call /api/purchase if this was a CASH transaction (not QR)
      if (!this.paymentId) {
        fetch("/api/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drinkId: String(this.selected.id) })
        }).catch(err => console.error("Failed to decrement stock:", err));
      }

      // Auto-transition after animation
      setTimeout(() => {
        this.step(Symbol.dispenseDone);
      }, 1500);
      return;
    }

    // Q8_COLLECT_ITEM: Enable user to open door and take item
    if (this.state === State.Q8_COLLECT_ITEM) {
      const cover = document.getElementById("cover");
      if (cover) {
        cover.onclick = () => {
          this.step(Symbol.openBox);
          UI.spawnDrinkAtDoor(this.selected.id, () => this.takeAway());
        };
      }
      return;
    }

    // Q9_REFUND: Return money (insertedCoins), DO NOT touch coinInventory
    if (this.state === State.Q9_REFUND) {
      UI.clearButtons();
      UI.setMsg(
        `Current State:\n${this.state}\n\n💰 Refunding:\n$${this.paidAmount.toFixed(2)}\n\nPlease collect your money...`
      );

      // Show refund coins in the coins box
      if (window.CashUI && this.paidAmount > 0) {
        CashUI.showRefundCoins(
          this.paidAmount,
          `💰 Refund: $${this.paidAmount.toFixed(2)}`,
          () => {
            console.log("Refund collected");
            // Clear transaction data (Option 2: insertedCoins discarded, coinInventory unchanged)
            this.paidAmount = 0;
            this.insertedCoins = { 1: 0, 0.5: 0, 0.25: 0 };
            this.step(Symbol.refundDone);
          }
        );
      } else {
        this.paidAmount = 0;
        this.insertedCoins = { 1: 0, 0.5: 0, 0.25: 0 };
        setTimeout(() => {
          this.step(Symbol.refundDone);
        }, 1000);
      }
      return;
    }
  }

  clearSelectionVisual() {
    if (!this.selected) return;
    const btn = document.getElementById(String(this.selected.id));
    if (btn) btn.src = "https://assets.codepen.io/4977637/button.png";
  }

  markSelected(btnEl) {
    if (btnEl) btnEl.src = "https://assets.codepen.io/4977637/buttonred.png";
  }

  selectDrink(btnEl) {
    if (this.state !== State.Q0_IDLE) {
      this.render("\n⚠️ Finish current operation or Cancel.");
      return;
    }

    const drink = findDrinkByBtnId(btnEl.id);
    if (!drink) return;

    this.selected = drink;
    this.markSelected(btnEl);
    this.step(Symbol.select);
  }

  async payByQR() {
    if (this.state !== State.Q2_CHOOSE_PAYMENT) return;

    // Transition to Q4_QR_PENDING
    this.step(Symbol.QR);

    if (window.CashUI) CashUI.hide();
    UI.clearButtons();
    // بعد ما يختار المستخدم طريقة الدفع (QR) امسح رسالة "Choose payment"
    UI.setMsg("");

    const res = await fetch(`/api/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drinkId: String(this.selected.id) })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      UI.setMsg(`❌ Payment Error\n\n${data.error || "Failed to create payment"}`);
      // Return to Q2
      this.step(Symbol.qrFail);
      return;
    }

    this.paymentId = data.paymentId;

    UI.setScreen(data.qr);
    

    // Start polling for payment status
    this.pollTimer = setInterval(async () => {
      const r = await fetch(`/api/payments/${this.paymentId}`);
      if (!r.ok) return;

      const p = await r.json();
      if (p.status === "paid") {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        TimeoutManager.stop(); // Stop timeout on successful payment
        this.step(Symbol.qrOk);
      } else if (p.status === "failed" || p.status === "canceled") {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        TimeoutManager.stop(); // Stop timeout on failure
        this.step(Symbol.qrFail);
      }
    }, 1000);

    // Start timeout for Q4
    TimeoutManager.start(() => {
      console.log("⏰ Timeout in Q4_QR_PENDING");
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.step(Symbol.timeout);
    });
  }

  payByCash() {
    if (this.state !== State.Q2_CHOOSE_PAYMENT) return;

    // Stop QR polling if active
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.paymentId = null;
    }

    // Transition to Q3_CASH_INSERTION
    this.step(Symbol.cash);

    UI.clearButtons();
    UI.setMsg(
      `Current State:\n${this.state}\n\n💰 اسحب العملات إلى المكان المخصص\nDrag coins to the cash slot`
    );

    if (window.CashUI) {
      CashUI.show(this.selected.price);
    }
  }

  takeAway() {
    if (this.state !== State.Q8_COLLECT_ITEM) return;

    const myDrink = document.getElementById("myDrink");
    if (myDrink) myDrink.style.left = "-90px";

    setTimeout(() => {
      this.step(Symbol.take);
    }, 600);
  }

  // Option 2: Change-making algorithm
  // Test case for noChange: price=$2.5, paid=$3 (1+1+1), changeRequired=$0.5
  // With coinInventory={1:10, 0.5:0, 0.25:0} -> cannot make $0.5 -> noChange -> Q9
  makeChange(amount, availableCoins) {
    // Work in cents to avoid floating-point issues
    let remainingCents = Math.round(amount * 100);
    const plan = { 1: 0, 0.5: 0, 0.25: 0 };
    
    // Denominations in cents
    const denominations = [
      { value: 1, cents: 100 },
      { value: 0.5, cents: 50 },
      { value: 0.25, cents: 25 }
    ];

    for (const denom of denominations) {
      while (remainingCents >= denom.cents && availableCoins[denom.value] > plan[denom.value]) {
        plan[denom.value]++;
        remainingCents -= denom.cents;
      }
    }

    // Check if we made exact change (remaining should be 0)
    if (remainingCents === 0) {
      return plan;
    }
    return null; // Cannot make change
  }

  // Apply change plan: consume from insertedCoins first, then coinInventory
  applyChangePlan(plan) {
    for (const coin in plan) {
      const needed = plan[coin];
      const coinValue = Number(coin);
      
      // Take from insertedCoins first
      const fromInserted = Math.min(needed, this.insertedCoins[coinValue]);
      this.insertedCoins[coinValue] -= fromInserted;
      
      // Take remaining from coinInventory
      const fromInventory = needed - fromInserted;
      this.coinInventory[coinValue] -= fromInventory;
    }
  }

  // Commit remaining insertedCoins to coinInventory (transaction successful)
  commitInsertedCoins() {
    for (const coin in this.insertedCoins) {
      this.coinInventory[coin] += this.insertedCoins[coin];
    }
    this.insertedCoins = { 1: 0, 0.5: 0, 0.25: 0 };
  }

  cancel() {
    // Cancel is only valid in Q2, Q3, Q4
    if (this.can(Symbol.cancel)) {
      this.clearSelectionVisual();
      this.step(Symbol.cancel);
    } else {
      console.warn("Cancel not available in current state:", this.state);
    }
  }
}

// -------------------- Init DFA --------------------
window.dfa = new VendingDFA();

// -------------------- Keep HTML onclicks working --------------------
// Your HTML uses: onclick="select(this,beverages)"
window.select = function (imgEl, beveragesEl) {
  if (beveragesEl) beveragesEl.state = true;
  dfa.selectDrink(imgEl);
};

// Optional compatibility
window.confirm = function () { };
window.cancel = function () { dfa.cancel(); };
window.exit = function () { dfa.cancel(); };
window.insertMoney = function () { dfa.payByCash(); };
window.showQRCode = function () { dfa.payByQR(); };
window.pay = function () { dfa.payByQR(); };
