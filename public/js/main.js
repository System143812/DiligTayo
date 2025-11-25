
const loader = document.getElementById('loadingOverlay');
const socket = io();
const clickBtn = document.getElementById('clickMeBtn');
const bodyContainer = document.getElementById('bodyContainer');
function showLoader() {
    loader.style.opacity = 1;
}
function hideLoader() {
    loader.style.opacity = 0;
}
showLoader();

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

socket.on('update-ui', (data) => {
    const newResponseBox = document.createElement('div');
    newResponseBox.className = 'message-boxes';
    newResponseBox.innerText = `${data.message}\n${data.timestamp}`;
    bodyContainer.append(newResponseBox);
});

// function initPageContents() {

// }

async function initEventListeners() {
    clickBtn.addEventListener("click", async() => {
        const data = await fetchGetData('/api/clickButton');
        if(data === "error") return;
    });
}



window.onload = async() => {
    // initPageContents();
    await initEventListeners();
    hideLoader();
}