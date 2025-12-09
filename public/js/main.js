
const loader = document.getElementById('loadingOverlay');
const clickBtn = document.getElementById('clickMeBtn');
const previousBtn = document.getElementById('previousBtn');
const nextBtn = document.getElementById('nextBtn');
const overwaterOverlay = document.getElementById('overwaterAlertOverlay');
const stillWaterBtn = document.getElementById('stillWaterBtn');
const cancelBtn =  document.getElementById('cancelBtn');
const infoShowBtn = document.getElementById('plantDataToggleBtn');
const infoContainer = document.getElementById('plantDataContainer');
const promptOverlay = document.getElementById('usernamePromptOverlay');
const usernameContainer = document.getElementById('usernameContainer');
const usernameInput = document.getElementById('usernameInput');
const usernameSubmitBtn = document.getElementById('usernameSubmitBtn');
const autoWaterToggle = document.getElementById('autoWaterCheckbox');
const autoSettingsBtn = document.getElementById('autoSettings');
const autoConfigContainer = document.getElementById('autoConfigContainer');
const configInputs = document.querySelectorAll('.config-inputs');
const configBoxes =  document.querySelectorAll('.config-container');
const minMoistInput = document.getElementById('minMoisture');
const maxMoistInput = document.getElementById('maxMoisture');
const saveConfigBtn = document.getElementById('saveConfigBtn')
const outerContainer = document.getElementById('outerContainer');
const bodyContainer = document.getElementById('bodyContainer');
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

const randomEmoji = ['🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🌱', '🌲', '☘', '🌳', '🌺'];

let waterAmount = 12; 
let currentPlantIndex = 0;
let currentImage;
let nextImage;
let current_humidity;
let current_moisture;
let currentPumpPin;
let currentSoilPin;
let last_water_timestamp;
let plantCollection = [];

function getAutoConfig() {
    const autoWaterConfig = { //eto yung default config ng autoWater
        username: Cookies.get("username"),
        targets: plantCollection[currentPlantIndex],
        min_moisture: Number(minMoistInput.value),
        max_moisture: Number(maxMoistInput.value),
        pump_pin: currentPumpPin,
        soil_pin: currentSoilPin
    }
    return autoWaterConfig;
}

function getMoisture() {
    const moistureStatus = {
        min_moisture: Number(minMoistInput.value),
        max_moisture: Number(maxMoistInput.value),
        current_moisture: current_moisture
    }
    return moistureStatus;
}

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

async function fetchPostData(url, form) {
    try {
        const formData = new FormData(form);
        const jsonData = Object.fromEntries(formData.entries());
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify(jsonData)
        });
        const data = await res.json();
        if(!data) return "error";
        if(data.status === 200) return "success";
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

function getTime(timestamp = null) {
    const date = timestamp ?  new Date(timestamp) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
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
    logBody.innerHTML = '';
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

    if (moisture <= 14 || hours > 72 || humidity <  20) {
        plantStatus.innerText = 'Critical';
        plantStatus.className = 'critical';
        return;
    }

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
    document.getElementById('soilProgressBar').style.width = `${(100 - moisture)}%`;
    document.getElementById('humidityProgressBar').style.width = `${(100 - humidity)}%`;
}

function activateAutoWater(socket) {
    const autoWaterConfig = getAutoConfig();
    socket.emit('activateAuto', { autoWaterConfig }); 
}

function deactivateAutoWater(socket) {
    const autoWaterConfig = getAutoConfig();
    socket.emit('deactivateAuto', { autoWaterConfig });
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
    currentImage = nextImage;
}

function automatePlant() {
    autoWaterToggle.checked = true;
    clickBtn.classList.add('auto-mode');
    clickBtn.innerText = 'Auto Mode';
}

function deautomatePlant() {
    autoWaterToggle.checked = false;
    clickBtn.classList.remove('auto-mode');
    clickBtn.innerText = 'Water Plant';
}

async function loadPlantData(currentIndex) {
    const plantData = await fetchGetData(`/api/plantData/${plantCollection[currentIndex]}`);
    if(plantData === 'error') return console.log("Network Connection Error");//dapat popup module nalabas dito kaso katamad
    if(plantData.length === 0) return console.log("Theres no any plants yet.");//dapat placeholder ang nandito kaso katamad din
    updateProgressStatus(plantData.soil_moisture, plantData.humidity);   
    current_moisture = plantData.soil_moisture; 
    currentPumpPin = plantData.pump_pin;
    currentSoilPin = plantData.soil_pin;
    plantNickname.innerText = plantData.nickname;
    document.getElementById('scientificName').innerText = plantData.name;
    updateLastWater(plantData.last_water);
    minMoistInput.value = plantData.min_moisture;
    maxMoistInput.value = plantData.max_moisture;
    last_water_timestamp = plantData.last_water;
    updatePlantStatus(plantData.last_water, plantData.soil_moisture, plantData.humidity);
    plantData.auto ? automatePlant() : deautomatePlant();
    nextImage = {image: plantData.image, no_bg: plantData.no_bg};
}

async function initDashboard(socket) {
    usernameContainer.innerText = Cookies.get("username");
    await loadLogs();
    await getPlants(currentPlantIndex);
    await loadPlantData(currentPlantIndex);
    setImage(currentImage);

    socket.on('automate', (data) => {
        if(data.autoWaterConfig.targets === plantCollection[currentPlantIndex]) {
            automatePlant();
        }
    })
    socket.on('deautomate', (data) => {
        if(data.autoWaterConfig.targets === plantCollection[currentPlantIndex]) {
            deautomatePlant();
        }
    }); 
    socket.on('updateMoisture', (data) => {
        const plantMoistures = data.plantMoistures;
        for (const plant of plantMoistures) {
            if(plant.plant_id === plantCollection[currentPlantIndex]) {
                current_moisture = plant.moisture;
                updatePlantStatus(last_water_timestamp, current_moisture, current_humidity);
                updateProgressStatus(current_moisture, current_humidity);
            }            
        }
    });
    socket.on('updateHumidity', (data) => {
        current_humidity = data.humidity;
        updatePlantStatus(last_water_timestamp, current_moisture, current_humidity);
        updateProgressStatus(current_moisture, current_humidity);
    });
    socket.on('updateAutoConfig', (data) => {
        if(data.autoWaterConfig.targets === plantCollection[currentPlantIndex]) {
            minMoistInput.value = data.autoWaterConfig.min_moisture;
            maxMoistInput.value = data.autoWaterConfig.max_moisture;
        }
    });
    socket.on('updateStatusPct', (data) => { //need gawin to// eto ung manggagaling sa esp32 na response
        updateProgressStatus();
        updatePlantStatus();
    });
    socket.on('updateLastWater', (data) => {
        if(data.plantId === plantCollection[currentPlantIndex]){
            updateLastWater(data.timestamp);
        }
    });
    socket.on('screenBubble', (data) => {
        const message = `${data.username} watered ${data.plantNickname} - around ${data.amount}mL`;
        popupBubble(message);
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

function popupBubble(message) {
    const bubbleDiv = document.createElement('div');
    const randHeight = Math.floor(Math.random() * 150) + 50;
    bubbleDiv.classList.add('popup-bubbles');
    bubbleDiv.style.top = `${randHeight}px`;
    bubbleDiv.innerText = `${randomEmoji[Math.floor(Math.random() * randomEmoji.length)]} ${message}`;
    bubbleDiv.classList.add('animate-bubble');
    bubbleDiv.addEventListener('animationend', () => {
        bubbleDiv.remove();
    }, { once: true });
    bodyContainer.append(bubbleDiv);
}

async function initEventListeners(socket) {
    let configFormValidity; 
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

    function waterPlantEvent() {
        const autoWaterConfig = getAutoConfig();
        const timestamp = getSqlTimestamp();
        socket.emit('waterPlant', {
            plantId: plantCollection[currentPlantIndex],
            time: getTime(),
            timestamp: timestamp,
            plantNickname: plantNickname.innerText,
            amount: waterAmount,
            pump_pin: autoWaterConfig.pump_pin,
            soil_pin: autoWaterConfig.soil_pin,
            max_moist: autoWaterConfig.max_moisture
        });
        updateLastWater(timestamp);
        last_water_timestamp = timestamp;
        popupNotif();
    }

    clickBtn.addEventListener("click", () => {
        const current_moist = getMoisture().current_moisture;
        const max_moist = getMoisture().max_moisture;
        console.log(`current moist: ${current_moist} | max moist: ${max_moist}`);
        if(current_moist >= max_moist) return showElement(overwaterOverlay);
        waterPlantEvent();
    });

    stillWaterBtn.addEventListener("click", () => {
        waterPlantEvent();
        hideElement(overwaterOverlay);
    });

    cancelBtn.addEventListener("click", () => {
        hideElement(overwaterOverlay);
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

    autoWaterToggle.addEventListener("change", () => {
        if(autoWaterToggle.checked) return activateAutoWater(socket);
        deactivateAutoWater(socket);
    });

    function showElement(div) {
        div.style.display = 'flex';
        setTimeout(() => { div.classList.add('show') }, 50);
    }

    function hideElement(div) {
        div.classList.remove('show');
        setTimeout(() => { div.style.display = 'none' }, 150);
    }

    function errorConfigInput(message, targetDiv) {
        for (const container of configBoxes) {
            if(container.contains(targetDiv)) {
                const inputBox = container.querySelector('input');
                const errorMessage = container.querySelector('.invalid-input');
                errorMessage.innerText = message;
                inputBox.classList.add('invalid');
                errorMessage.classList.add('error');    
            }
        }
        configFormValidity = false;
    }

    function validConfigInput(targetDiv) {
        for (const container of configBoxes) {
            if(container.contains(targetDiv)) {
                container.querySelector('input').classList.remove('invalid');
                container.querySelector('.invalid-input').classList.remove('error');
                if(targetDiv === minMoistInput) {
                    container.querySelector('.invalid-input').innerText = "*Minimum 0%";
                } else {
                    container.querySelector('.invalid-input').innerText = "*Maximum 100%";
                }
            }
        }
    }

    autoSettingsBtn.addEventListener('click', () => {
        autoConfigContainer.classList.contains('show') ? hideElement(autoConfigContainer) : showElement(autoConfigContainer);
    });

    outerContainer.addEventListener("click", (e) => {
        if(!autoConfigContainer.contains(e.target) && e.target !== autoSettingsBtn) hideElement(autoConfigContainer);
    });

    
    for (const configInput of configInputs) {
        configInput.addEventListener('keydown', (e) => {
            if(e.key === "-" || e.key === "e") e.preventDefault();
        });
        configInput.addEventListener("input", () => {
            showElement(saveConfigBtn);
            const value = Number(configInput.value);
            const minValue = Number(minMoistInput.value);
            const maxValue = Number(maxMoistInput.value);

            if(value < 0 || configInput.value === "" || configInput.value === "-") errorConfigInput("Value below 0 is not valid", configInput);
            if(value > 100) { 
                errorConfigInput("Value cannot exceed above 100%", configInput);
            } else if(maxValue < minValue) {
                errorConfigInput("Value must not lower than minimum moisture", maxMoistInput);
                errorConfigInput("Value must not higher than maximum moisture", minMoistInput);
            } else if((maxValue > minValue) && (minValue >= 0 && minValue <= 100) && (maxValue >= 0 && maxValue <= 100)) {
                for (const config of configInputs) {
                    validConfigInput(config);
                }
                configFormValidity = true;
            }
        });
    }
    
    autoConfigContainer.addEventListener("submit", async(e) => {
        e.preventDefault()
        if(!configFormValidity) return;
        const response = await fetchPostData(`/api/saveAutoConfig/${plantCollection[currentPlantIndex]}`, autoConfigContainer);
        if(response === "error") return console.error('Network Connection Error');
        const autoWaterConfig = getAutoConfig();
        socket.emit('saveAutoConfig', { autoWaterConfig: autoWaterConfig });
        hideElement(saveConfigBtn);
    })

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
    const isProduction = window.location.protocol === 'https:';
    usernameSubmitBtn.addEventListener('click', async() => {
        if(usernameInput.value === "") return showRequired(usernameInput);
        usernameInput.classList.remove('required');
        const username = usernameInput.value;
        Cookies.set("username",  username, {
            expires : 1,
            path : "/",
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction
        });
        await initWebsocketUser();
        hideUserOverlay();
    });
}

async function initWebsocketUser() {
        socket = io();
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
        await clickInitUser();
    } else {
        hideUserOverlay();
        await initWebsocketUser();
    }
    hideLoader();
}