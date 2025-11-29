
const loader = document.getElementById('loadingOverlay');
const clickBtn = document.getElementById('clickMeBtn');
const previousBtn = document.getElementById('previousBtn');
const nextBtn = document.getElementById('nextBtn');
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
const plantImageContainer = document.getElementById('plantImageContainer');
// const plantImage = document.getElementById('plantImage');
const usernamePromptContainer = document.getElementById('usernamePromptContainer');
let currentImageDiv;
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

let waterAmount = 12;
let currentPlantId = 1;
let currentPlantIndex = 0;
let currentImage;
let nextImage;
let last_water_timestamp;
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
    if(timeDiff < 120000) return 'just now';
    if(timeDiff < 3600000) return `${Math.floor(timeDiff / 60000)} minutes ago`;
    if(timeDiff < 7200000) return `an hour ago`;
    if(timeDiff < 86400000) return `${Math.floor(timeDiff / 3600000)} hours ago`;  
    if(timeDiff < 172800000) return `yesterday`;
    return `${Math.floor(timeDiff / 86400000)} days ago`;
}

function getTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
}

function getSqlTimestamp() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, "0");
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());

    return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
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


function updateLastWater(timestamp) {
    document.getElementById('recentWaterStatus').innerText = `Last Watered | ${getTime(timestamp)} | ${getDateDuration(timestamp)}`;
}

function updatePlantStatus(last_water, moisture, humidity) {
    const plantStatus = document.getElementById('plantStatus');
    const timeDiffMs = Date.now() - new Date(last_water).getTime();
    const mins = Math.floor(timeDiffMs / 60000);
    const hours = Math.floor(timeDiffMs / 3600000);

    if(moisture > 85 || (moisture > 75 && mins > 5 )){
        plantStatus.innerText = 'Soaked';
        plantStatus.className = 'soaked';
        return;
    }

    if (moisture >= 65 && moisture <= 80) {
        plantStatus.innerText = 'Wet';
        plantStatus.className = 'wet';
        return;
    }

    if (moisture >= 35 && moisture < 65 && humidity >= 40 && humidity <= 70) {
        plantStatus.innerText = 'Healthy';
        plantStatus.className = 'healthy';
        return;
    }

    if (moisture >= 15 && moisture < 35 || (humidity < 40 && humidity >= 25 )) {
        plantStatus.innerText = 'Dry';
        plantStatus.className = 'dry';
        return;
    }

    if (moisture <= 14 || hours > 72 || humidity <  25 || humidity > 85) {
        plantStatus.innerText = 'Critical';
        plantStatus.className = 'critical';
        return;
    }

    plantStatus.innerText = 'Healthy';
    plantStatus.className = 'healthy';
    return;
}

function updateProgressStatus(moisture, humidity) {
    let soilStatus;
    let humidityStatus;
    if(moisture >= 0 && moisture < 10) {
        soilStatus = 'Very Dry';
    } 
    if(moisture >= 10 && moisture < 25) {
        soilStatus = 'Dry';
    }
    if(moisture >= 25 && moisture < 45) {
        soilStatus = 'Slightly Moist';
    }
    if(moisture >= 45 && moisture < 65) {
        soilStatus = 'Moist';
    }
    if(moisture >= 65 && moisture < 80) {
        soilStatus = 'Wet';
    }
    if(moisture >= 80) {
        soilStatus = 'Soaked';
    }
    if(humidity >= 0 && humidity < 20) {
        humidityStatus = 'Very Low';
    }
    if(humidity >= 20 && humidity < 40) {
        humidityStatus = 'Low';
    }
    if(humidity >= 40 && humidity < 60) {
        humidityStatus = 'Moderate';
    }
    if(humidity >= 60 && humidity < 75) {
        humidityStatus = 'Slightly High';
    }
    if(humidity >= 75 && humidity < 85) {
        humidityStatus = 'High';
    }
    if(humidity >= 85) {
        humidityStatus = 'Very High';
    }
    
    document.getElementById('soilDataStatus').innerText = soilStatus;
    document.getElementById('humidityDataStatus').innerText = humidityStatus;
    document.getElementById('moisturePercentage').innerText = `${moisture}%`;
    document.getElementById('soilProgressPercentage').innerText = `${moisture}%`;
    document.getElementById('humidityPercentage').innerText = `${humidity}%`;
    document.getElementById('humidityProgressPercentage').innerText = `${humidity}%`;
    document.getElementById('soilProgressBar').style.background = `linear-gradient(to right, var(--grayed-no-opacity) ${moisture}%, var(--light-gray) ${moisture}%)`;
    document.getElementById('humidityProgressBar').style.background = `linear-gradient(to right, var(--grayed-no-opacity) ${humidity}%, var(--light-gray) ${humidity}%)`;
}

function setImage() {
    currentImage = nextImage;
    const plantImage = document.createElement('div');
    plantImage.id = 'plantImage';
    plantImage.classList.add('plant-image');
    plantImage.style.backgroundImage = `url('/assets/pictures/${currentImage.image}')`;
    currentImage.no_bg ? plantImage.style.backgroundSize = 'contain' : plantImage.style.backgroundSize = 'cover';
    plantImageContainer.append(plantImage);
    currentImageDiv = plantImage;
}  



function insertNewImage(direction) {
   
    const newImage = document.createElement('div');
    newImage.id = 'plantImage';
    newImage.classList.add('plant-image');
    newImage.style.backgroundImage = `url('/assets/pictures/${nextImage.image}')`;
    nextImage.no_bg ? newImage.style.backgroundSize = 'contain' : newImage.style.backgroundSize = 'cover';
    console.log(currentImageDiv);
    if(direction === 'next'){
        newImage.classList.add('insert-left');
        currentImageDiv.classList.add('move-left');
    } else {
        newImage.classList.add('insert-right');
        currentImageDiv.classList.add('move-right');
    }
    plantImageContainer.append(newImage);
    currentImageDiv.addEventListener("animationend", () => {
        currentImageDiv.remove();
        currentImageDiv = newImage;
        currentImageDiv.classList.remove('insert-right');
        currentImageDiv.classList.remove('insert-left');
    }, { once: true })
    console.log(currentImageDiv);
    currentImage = nextImage;
}

async function loadPlantData(currentIndex) {
    const currentPlant = plantCollection[currentIndex];
    const plantData = await fetchGetData(`/api/plantData/${currentPlant}`);
    if(plantData === 'error') return console.log("Network Connection Error");//dapat popup module nalabas dito kaso katamad
    if(plantData.length === 0) return console.log("Theres no any plants yet.");//dapat placeholder ang nandito kaso katamad din
    currentPlantId = plantData.plant_id;
    updateProgressStatus(plantData.soil_moisture, plantData.humidity);    
    plantNickname.innerText = plantData.nickname;
    document.getElementById('scientificName').innerText = plantData.name;
    updateLastWater(plantData.last_water);
    last_water_timestamp = plantData.last_water;
    updatePlantStatus(plantData.last_water, plantData.soil_moisture, plantData.humidity);
    nextImage = {image: plantData.image, no_bg: plantData.no_bg};
}

async function initDashboard(socket) {
    usernameContainer.innerText = Cookies.get("username");
    await loadLogs();
    await getPlants(currentPlantIndex);
    await loadPlantData(currentPlantIndex);
    setImage(currentImage);
    socket.on('updateLastWater', (data) => {
        if(data.plantId === currentPlantId){
            updateLastWater(data.timestamp);
        }
    });
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
    plantImageContainer.append(popupDiv);
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
        const timestamp = getSqlTimestamp();
        socket.emit('waterPlant', {plantId: currentPlantId, time: time, timestamp: timestamp, plantNickname: plantNickname.innerText, amount: waterAmount});
        updateLastWater(timestamp);
        last_water_timestamp = timestamp;
        popupNotif();
    });

    previousBtn.addEventListener("click", async() => {
        currentPlantIndex = currentPlantIndex === 0 ? plantCollection.length - 1 : currentPlantIndex - 1;
        await loadPlantData(currentPlantIndex);
        updateNavIndex(currentPlantIndex);
        insertNewImage('prev');
        
    });

    nextBtn.addEventListener("click", async() => {
        currentPlantIndex = currentPlantIndex === plantCollection.length - 1 ? 0 : currentPlantIndex + 1;
        await loadPlantData(currentPlantIndex);
        updateNavIndex(currentPlantIndex);
        insertNewImage('next');
        
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

setInterval(() => {
    loadLogs();
    updateLastWater(last_water_timestamp);
}, 60000);


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