
const loader = document.getElementById('loadingOverlay');
const clickBtn = document.getElementById('clickMeBtn');
const startBtn = document.getElementById('')
const infoShowBtn = document.getElementById('plantDataToggleBtn');
const infoContainer = document.getElementById('plantDataContainer');
const promptOverlay = document.getElementById('usernamePromptOverlay');
const usernameInput = document.getElementById('usernameInput');
const usernameSubmitBtn = document.getElementById('usernameSubmitBtn');
const logBody = document.getElementById('logBody');
const logIcon = document.getElementById('logHeaderIcon');
const logHeader = document.getElementById('logHeaderContainer');
const currentPlant = document.getElementById('plantNickname').innerText;
const plantImage = document.getElementById('plantImage');
const usernamePromptContainer = document.getElementById('usernamePromptContainer');

let socket;

function showLoader() { loader.style.opacity = 1 }
function hideLoader() { loader.style.opacity = 0 }
showLoader();

function showUserOverlay() { promptOverlay.classList.add("show") }
function hideUserOverlay() { promptOverlay.classList.remove("show") }
function showRequired(inputField) {
    inputField.classList.add('required');
}
const randomMsg = [
    'Successfully watered the plant!',
    '+10exp',
    'Watering successful',
    "Don't drown it!",
    'Good Job! 👍',
    '+20hp',
    'Keep it up, Plantito! 🌳',
    '+30respect',
    'Need more water!',
    'Aray mo',
    'Lunod na pre',
    'Sanaol dinidiligan💦',
    'Paldo 🤑',
    'PLANT: TY yah😘',
    'PLANT: Awit sayo sah',
    'Alam mo ah 😏'
];

async function fetchGetData(url) {
    try {
        const response = await fetch(url, { headers: {"Accept":"application/json"}});
        const data = await response.json();
        if(!data) return "error";
        return data;
    } catch (error) {
        console.log(`Error occured: ${error}`);
        return "error";
    }
}

async function initDashboard(socket) {
    socket.on('createLog', (data) => {
        const logCards = document.createElement('div');
        logCards.classList.add('log-cards');
        const logMessage = document.createElement('div');
        logMessage.classList.add('log-message');
        logMessage.innerText = `${data.username} waters ${currentPlant}`;
        const logDate = document.createElement('div');
        logDate.classList.add('log-date');
        logDate.innerText = `${data.timestamp} | Today`;

        logCards.append(logMessage, logDate);
        logBody.prepend(logCards);
    });

    await initEventListeners(socket);
}

function popupNotif() {
    const popupDiv = document.createElement('div');
    const randHeight = Math.floor(Math.random() * 50);
    const randWidth = Math.floor(Math.random() * 150);
    const randomMessage = randomMsg[Math.floor(Math.random() * randomMsg.length)];
    popupDiv.id = 'popupNotif';
    popupDiv.style.left = `${randWidth}px`;
    popupDiv.style.bottom = `${randHeight}px`;
    popupDiv.innerText = randomMessage;

    setTimeout(() => {
        popupDiv.style.display = 'none';
    }, 4000);
    plantImage.append(popupDiv);
}

async function initEventListeners(socket) {
    logHeader.addEventListener("click", () => {
        if(logIcon.classList.contains("show")) {
            logIcon.classList.remove("show");
            logBody.style.opacity = 0;
            setTimeout(() => {
                logBody.classList.remove("show");
            }, 550);
        } else {
            logBody.classList.add("show");  
            setTimeout(() => {
                logIcon.classList.add("show");
                logBody.style.opacity = 1;
            }, 50);
        }
    });

    clickBtn.addEventListener("click", async() => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
        socket.emit('waterPlant', {timestamp: timestamp});
        popupNotif();
    });
    infoShowBtn.addEventListener("click", () => {
        if(infoShowBtn.classList.contains("show")){
            infoShowBtn.classList.remove("show");
            infoContainer.classList.remove("show");
        } else {
            infoShowBtn.classList.add('show');
            infoContainer.classList.add("show");
        }
    });
}

async function clickInitUser() {
    usernameSubmitBtn.addEventListener('click', async() => {
        if(usernameInput.value === "") return showRequired(usernameInput);
        usernameInput.classList.remove('required');
        const username = usernameInput.value;
        Cookies.set("username",  username, {
            expires : 1,
            path : "/",
            sameSite: "lax",
            secure: true
        });
        initWebsocketUser();
        hideUserOverlay();
    });
}

async function initWebsocketUser() {
        socket = io();
        socket.emit('getUsername');
        await initDashboard(socket);    
} 


window.onload = async() => {
    // Cookies.remove("username"); //Pang force reset lang to
    if(!Cookies.get("username")) {
        showUserOverlay();
        await clickInitUser()
    } else {
        hideUserOverlay();
        await initWebsocketUser();
    }
    hideLoader();
}