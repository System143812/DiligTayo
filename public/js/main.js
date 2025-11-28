
const loader = document.getElementById('loadingOverlay');
const clickBtn = document.getElementById('clickMeBtn');
const startBtn = document.getElementById('')
const infoShowBtn = document.getElementById('plantDataToggleBtn');
const infoContainer = document.getElementById('plantDataContainer');
const promptOverlay = document.getElementById('usernamePromptOverlay');
const usernameContainer = document.getElementById('usernameContainer');
const usernameInput = document.getElementById('usernameInput');
const usernameSubmitBtn = document.getElementById('usernameSubmitBtn');
const logBody = document.getElementById('logBody');
const logIcon = document.getElementById('logHeaderIcon');
const logHeader = document.getElementById('logHeaderContainer');
const plantNickname = document.getElementById('plantNickname');
const roundNavContainer = document.getElementById('roundNavContainer');
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

let waterAmount = 12;

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

let currentPlantIndex = 2;
let plantCollection = [];

async function fetchGetData(url) {
    try {
        const response = await fetch(url, {
            headers: {
                "Accept":"application/json"
            }
        });
        const data = await response.json();
        if(!data) return "error";
        return data;
    } catch (error) {
        console.log(`Error occured: ${error}`);
        return "error";
    }
}

function getDateDuration(timestamp) {
    const timeDiff = Date.now() - new Date(timestamp).getTime();
    if(timeDiff < 86400000) return `Today`;  
    if(timeDiff < 172800000) return `Yesterday`;
    return `${Math.floor(timeDiff / 86400000)} days ago`;
}

function getTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
}

async function loadLogs() {  
    const logs = await fetchGetData('/api/logs');
    if(logs === 'error') return console.log('Network Connection Error');
    if(logs.length === 0) {
        const emptyLogPlaceholder = document.createElement('div');
        emptyLogPlaceholder.id = 'emptyLogPlaceholder';
        emptyLogPlaceholder.innerText = 'No recent activities yet'
        return logBody.append(emptyLogPlaceholder);
    }
    for (const log of logs) {
        const logCards = document.createElement('div');
        logCards.classList.add('log-cards');
        const logMessage = document.createElement('div');
        logMessage.classList.add('log-message');
        logMessage.innerText = log.log_detail;
        const logDate = document.createElement('div');
        logDate.classList.add('log-date');
        logDate.innerText = `${getTime(log.created_at)} | ${getDateDuration(log.created_at)}`;

        logCards.append(logMessage, logDate);
        logBody.prepend(logCards);
    }
}

async function getPlants(currentIndex) {
    plantCollection = [];
    const plants = await fetchGetData('api/plantId');
    if(plants === 'error') return console.log("Network Connection Error");//dapat popup module nalabas dito kaso katamad
    if(plants.length === 0) return console.log("Theres no any plants yet.");//dapat placeholder ang nandito kaso katamad din
    for (const plant of plants) {
        plantCollection.push(plant.plant_id);
    }
    roundNavsCreate(currentIndex);
}

function updateNavIndex(currentIndex) {
    const roundNavs = document.querySelectorAll('.round-nav');
    let count = 0;
    for (const roundNav of roundNavs) {
        if(count === currentIndex) {
            roundNav.classList.add('selected');
        } else {
            roundNav.classList.remove('selected');
        }
        count++;
    }
}

function roundNavsCreate(currentIndex) {
    roundNavContainer.innerHTML = '';
    for (const plant of plantCollection) {
        const roundNav = document.createElement('span');
        roundNav.classList.add('round-nav');
        roundNavContainer.append(roundNav);    
    }
    updateNavIndex(currentIndex);
}


async function loadPlantData(currentIndex) {
    const currentPlant = plantCollection[currentIndex];
    const plantData = await fetchGetData(`/api/plantData/${currentPlant}`);
    if(plantData === 'error') return console.log("Network Connection Error");//dapat popup module nalabas dito kaso katamad
    if(plantData.length === 0) return console.log("Theres no any plants yet.");//dapat placeholder ang nandito kaso katamad din
    const headerMoisturePct = document.getElementById('moisturePercentage');
    const dataMoisturePct = document.getElementById('soilProgressPercentage');
    headerMoisturePct.innerText = `${plantData.soil_moisture}%`;
    dataMoisturePct.innerText = `${plantData.soil_moisture}%`;
    const headerHumidityPct = document.getElementById('humidityPercentage');
    const dataHumidityPct = document.getElementById('humidityProgressPercentage');
    headerHumidityPct.innerText = `${plantData.humidity}%`;
    dataHumidityPct.innerText = `${plantData.humidity}%`;
    plantNickname.innerText = plantData.nickname;
    document.getElementById('scientificName').innerText = plantData.name;
    document.getElementById('recentWaterStatus').innerText = `Last Watered | ${getTime(plantData.last_water)} ${getDateDuration(plantData.last_water)}`;
    document.getElementById('plantStatus').innerText = 'Healthy';
    document.getElementById('soilProgressBar').style.background = `linear-gradient(to right, var(--grayed-no-opacity) ${plantData.soil_moisture}%, var(--light-gray) ${plantData.soil_moisture}%)`;
    document.getElementById('humidityProgressBar').style.background = `linear-gradient(to right, var(--grayed-no-opacity) ${plantData.humidity}%, var(--light-gray) ${plantData.humidity}%)`;
    document.getElementById('plantImage').style.backgroundImage = `url('/assets/pictures/${plantData.image}')`;
}

async function initDashboard(socket) {
    usernameContainer.innerText = Cookies.get("username");
    await loadLogs();
    await getPlants(currentPlantIndex);
    await loadPlantData(currentPlantIndex);

    socket.on('createLog', (data) => {
        const emptyLogPlaceholder = document.getElementById('emptyLogPlaceholder')
        if(emptyLogPlaceholder) emptyLogPlaceholder.remove();
        const logCards = document.createElement('div');
        logCards.classList.add('log-cards');
        const logMessage = document.createElement('div');
        logMessage.classList.add('log-message');
        logMessage.innerText = `${data.username} watered ${data.plantNickname} - around ${data.amount}mL`;
        const logDate = document.createElement('div');
        logDate.classList.add('log-date');
        logDate.innerText = `${data.time} | ${getDateDuration(data.timestamp)}`;

        logCards.append(logMessage, logDate);
        logBody.prepend(logCards);
    });

    await initEventListeners(socket);
}

function popupNotif() {
    const popupDiv = document.createElement('span');
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
            }, 150);
        } else {
            logBody.classList.add("show");  
            setTimeout(() => {
                logIcon.classList.add("show");
                logBody.style.opacity = 1;
            }, 50);
        }
    });

    clickBtn.addEventListener("click", async() => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
        const timestamp = new Date();
        socket.emit('waterPlant', {time: time, timestamp: timestamp, plantNickname: plantNickname.innerText, amount: waterAmount});
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
    // Cookies.remove("username"); //Pang force reset lang to ng cookies
    if(!Cookies.get("username")) {
        showUserOverlay();
        await clickInitUser()
    } else {
        hideUserOverlay();
        await initWebsocketUser();
    }
    hideLoader();
}