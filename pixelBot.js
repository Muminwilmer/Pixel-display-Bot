javascript:(function(){
    let index = 0;
    let totalCount = 0;
    let sameColorCount = 0;
    let startY;
    let width;
    let currentY;
    let currentX;
    let useSaved;
    let pixelLeft; // left owned
    let remainingPixels; // left to place
    let authToken;
    const boardList = new Array(64 * 64).fill(0);
    const colors = [];
    const socket = new WebSocket('wss://display.stamsite.nu/server');
    
    function convertMs(ms) {
        let seconds = Math.floor(ms / 1000);
        let hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        let minutes = Math.floor(seconds / 60);
        seconds %= 60;
        
        // Format result
        let result = '';
        if (hours > 0) {
            result += hours + 'h ';
        }
        if (minutes > 0) {
            result += minutes + 'm ';
        }
        if (seconds > 0 || result === '') {
            result += seconds + 's';
        }
        return result;
    }

    function configurePixels() {
        const colorCodes = [];
        let lastColor;
        if (localStorage.getItem('savedColors')){
            useSaved = prompt(`Would you like to use your saved colors?\n${localStorage.getItem('savedColors')}\n(y,n)`);
            if (useSaved=="y"){
                colors.push(...JSON.parse(localStorage.getItem('savedColors')));
            }
        }
        if (useSaved!=="y" || !localStorage.getItem('savedColors')){
            while (lastColor!==-1){
                let color = prompt(`Choose a color:\nRed:0, Green:1, Blue:2, Yellow:3, Orange:4, Purple:5, Cyan:6, White:7, Black:8, Gray:9, DRed:10, DGreen:11, DBlue:12, DYellow:13, Brown:14, Magenta:15, LGreen:16, DGray:17, Pink:18, Beige:19\nWhen done -1\n${colorCodes}`);
                if (color==-1){
                    lastColor=-1
                }else{
                    if (color.match(/(?![\d,])\w/)) return; // Includes letters
                    if (color.match(/,/)){ // If it has ,
                        const listColors = color.split(",");
                        for (let i = 0; i < listColors.length; i++) {
                            colors.push({ color: parseInt(listColors[i]) });
                            colorCodes.push(parseInt(listColors[i]));
                        }
                    }else{
                        if (color < 0 || color > 19) return;
                        colors.push({ color: parseInt(color) });
                        colorCodes.push(parseInt(color));
                    }
                }
            }
            if (prompt(`Would you like to save these color to localstorage? (y/n)`)=="y"){
                localStorage.setItem('savedColors', JSON.stringify(colors));
                console.log("saved",localStorage.getItem('savedColors'));
            }
        }

        let startX = parseInt(prompt("Enter the starting Height position (Top: 0, Bottom: 63) (X)", "0"));
        if (isNaN(startX)) return;

        startY = parseInt(prompt("Enter the starting Length position (Left: 0, Right: 63) (Y)", "0"));
        if (isNaN(startY)) return;

        width = parseInt(prompt("Art width (Loops at this instead of 64) - (Left: 1, Right: 64)", "64"))+startY;
        if (isNaN(width)) return;

        authToken = decodeURIComponent(document.cookie).match(/access_token=([^;]*)/)?.[1]||'';
        if (!authToken) authToken = prompt("Enter your access token. This is automatic if you're on the website");

        remainingPixels = colors.length * (width - startY);
        alert(`Max Cost: ${remainingPixels} Pixels!\nMax Time: ${convertMs(remainingPixels*3000)}`);

        currentX = startX;
        currentY = startY;
        socket.addEventListener('message', handleResponse);
    }

    configurePixels();

    async function sendPixels() {
        if (currentY >= width) currentY = startY;
        let next = index + 1;
        while (true) {
            if (boardList[(currentX*64) + currentY] != colors[next % colors.length].color) {
                break;
            };
            index++;
            next++;
            if (index == colors.length) {
                index = -1;
                currentY++;
            };
            if (next >= colors.length) {
                next = 0;
                if (index == 0) {
                    currentY++;
                }
            };
        }
        const message = colors[next];
        const authData = { access_token: authToken };
        message.x = currentX + index+1;
        message.y = currentY;
        remainingPixels = colors.length * (width - message.y);
        const payload = {
            "type": "SetPixel",
            "date": Date.now(),
            "data": message,
            "authData": authData
        };
        sameColorCount++;
        socket.send(JSON.stringify(payload));
        await new Promise((resolve) => setTimeout(resolve, 1200));
        sendPixels();
    }

    function handleResponse(event) {
        const response = JSON.parse(event.data);
        if (response.type === 'GetBoard') {
          updateBoard(response.data.board.pixels);
          sendPixels();
        } else if (response.type === 'PixelUpdate') {
          const { x, y, color } = response.data.pixelChanged;
          pixelLeft = response.data.newPixels;
          updatePixel(x, y, color);
        }

        const skipList = [
            "PixelUpdate",
            "ActiveCount",
            "UserChange"
        ];


        if (skipList.includes(response.type)) return;

        if (response.type == "Error"){
            sameColorCount--;
            if (response.data.match(/\[S\] Du ändrar pixlar för snabbt!/)) return;
            totalCount++;
        }

        if (response.type == "PixelUpdate") {
            // If pixelUpdate was made by me add 1 to index
            if (update.data.newPixels !== undefined) {
                index++;
                if (index === colors.length) {
                    index = 0;
                    currentY++;
                }
            }
        }
    }

    function updateBoard(pixels) {
        // Update the boardList array with initial pixels
        boardList.splice(0, boardList.length, ...pixels);
        console.log('Initial board received:', boardList);
    }
      
    function updatePixel(x, y, color) {
        // Update the pixel in the board list
        const index = (x * 64) + y;
        boardList[index] = color;
        console.log(`Pixel at (${x},${y}) updated to ${color}`);
        console.log(`\n\n# ------------------------------------------------------- #\n# Pixels Placed: ${totalCount-(totalCount-sameColorCount)}\n# Pixels left: ${pixelLeft}\n# Remaining pixels: ${remainingPixels}\n# Need More: ${pixelLeft<remainingPixels}\n# Current Y Position: ${currentY}\n# Current X Position: ${Math.floor(index/width)}\n# ------------------------------------------------------- #\n\n`);
    }
})();
