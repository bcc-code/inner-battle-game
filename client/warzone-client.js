//====================================================
// External libraries
//====================================================

var socket = io(); // Socket.io communication

//====================================================
// Variables
//====================================================

// Player ID
var playerID = "";

// Player object
// |- name
// |- phoneNumber
// |- gameID
// |- creditZar
// |- creditNok
// |- totalZar
// |- totalNok
var player = {
    name        : '',
    phoneNumber : '',
    gameID      : undefined,
    creditZar   : 0,
    creditNok   : 0,
    totalZar    : 0,
    totalNok    : 0,
};

// Game object
// - title
// - totalZar
// - totalNok
var game = {
    title       : '',
    totalZar    : 0,
    totalNok    : 0,
};

// Weapons
// weaponID (incremental key)
// |- name
// |- cost
// |- text
// |- seller
// |- image
var weapon = {};

// True if auth was successful
var auth = false;

// Player status counters in use
var playerStatus = {
    credit  : false,
    total   : false,
};

// Game total status counter in use
var gameStatus = {
    total   : false,
}

// weapon requested
var weaponReq = false;

// visor active
var visorOn = false;

// visor settings
// - diameter
// - weaponID
var visor = {
    diameter : 0,
};

// shot data
var shot = {
    x        : 960, // default position for visor in touch mode
    y        : 540, // default position for visor in touch mode
    weaponID : 0,
}

// game div zoom percentage.
var zoom = 100;

// counter to keep track of victories. After recovering from a broken connection,
// use this counter to determine which victories should be added.
var victoryCount = 0;

// set to true when touch event is detected
var isTouch = false;

// selected weapon card's weapon ID
var weaponCardID = 0;

//====================================================
// Initialization
//====================================================

// Zoom to fit content
setZoom();

//====================================================
// socket.io communication
//====================================================

// Clear data on connection / reconnection
socket.on("connect", () => {
    // Clear weapons list
    weapon = {};

    // Delete all weapons from html
    $('#weaponList').html("");
});

// Store player details and request authorization from server
function reqAuth(gameID, loginName, loginPhoneNumber) {
    player.gameID = gameID;
    player.name = loginName;
    player.phoneNumber = loginPhoneNumber;

    // Send auth request to server
    socket.emit('reqAuth', player);
}

socket.on('authSuccess', (id) => {
    $('#loginError').text("Login successful!");
    $('#loginModal').css('display', 'none');
    playerID = id;

    // Clear weapons (server will re-send list of weapons)
    weapon = {};
    $('#weaponList').html('');

    // Set game to full-screen mode
    openFullscreen();

    // Set zoom
    setZoom();

    // request list of victories
    socket.emit('reqVictory', victoryCount);
});

socket.on('authFail', (message) => {
    $('#loginModal').css('display', 'block');
    $('#loginError').css('color', 'orange');
    $('#loginError').text(message);
    playerID = "";

    // clear weapons list
    weapon = {};
    $('#weaponList').html('');

    // clear victories
    $('#victoryList').html('');
    victoryCount = 0;

    // Hide visor
    $("#visor").css('display', 'none');
    visorOn = false;

    // Hide buy Weapon modal
    $("#weaponModal").css('display', 'none');
});

// Request from server to authenticate. Only used if already logged in but connection was interrupted.
socket.on('auth', () => {
    if (playerID != "") {
        // Send auth request to server
        socket.emit('reqAuth', player);
    }
});

// Receive weapons from server
socket.on('weapon', (data) => {
    if (playerID != "") {
        Object.keys(data).forEach((weaponID) => {
            // check if weapon does not already exist
            if (weapon[weaponID] == undefined) {
    
                // Add to weapon object
                weapon[weaponID] = data[weaponID];
    
                // Add weapon card (html)
                htmlAddWeapon(weaponID);
            }
        });
    }
});

// Request to buy weapon
function reqBuyWeapon(weaponID) {
    socket.emit('buyWeapon', weaponID);
}

// Remove weapon command from server
socket.on('removeWeapon', (weaponID) => {
    // Remove weapon from list
    delete weapon[weaponID];

    // Remove weapon from html
    htmlRemoveWeapon(weaponID);
});

// Receive updated player data
socket.on('playerData', (data) => {
    player.creditZar = data.creditZar;
    player.creditNok = data.creditNok;
    player.totalZar = data.totalZar;
    player.totalNok = data.totalNok;

    $('#statusVal1Credit').text(`ZAR ${player.creditZar}`);
    $('#statusVal2Credit').text(`NOK ${player.creditNok}`);

    $('#statusVal1PlayerTotal').text(`ZAR ${player.totalZar}`);
    $('#statusVal2PlayerTotal').text(`NOK ${player.totalNok}`);
});

// Receive updated game data
socket.on('gameData', (data) => {
    game.totalZar = data.totalZar;
    game.totalNok = data.totalNok;

    $('#statusVal1GameTotal').text(`ZAR ${game.totalZar}`);
    $('#statusVal2GameTotal').text(`NOK ${game.totalNok}`);
});

// Receive updated game title
socket.on('gameTitle', (data) => {
    game.title = data;
    $('#titleBanner').text(game.title);
});

// Receive visor settings
socket.on('visor', (data) => {
    visorOn = true;
    $("#visorShot").css("height", data.diameter);
    $("#visorShot").css("width", data.diameter);
    shot.weaponID = data.weaponID;
    visor.diameter = data.diameter;

    // set initial visor position under cursor
    setVisorPosition();

    // show visor
    $("#visor").css('display', 'block');
});

// Request to shoot
function reqShoot() {
    socket.emit('reqShoot', shot);
}

// Receive array with victory/victories from server
socket.on('victory', (data) => {
    // If more than one victory is received, do not display names
    var showName = true
    if (data.length > 1) {
        showName = false;
    }

    // display victories
    data.forEach((v) => {
        showVictory(v,showName);
    });
});

//====================================================
// login
//====================================================

function login() {
    var id = $('#gameID').val();
    var name = $('#loginName').val();
    var phoneNumber = $('#loginPhoneNumber').val();

    if (id != undefined && id != "" &&
    name != undefined && name != "" &&
    phoneNumber != undefined && phoneNumber != "") {
        // Request auth
        reqAuth(id, name, phoneNumber);
    }
    else {
        $('#loginError').css('color', 'orange');
        $('#loginError').text("We tried our best, but this did not work... Please fill in the game ID, your name and surname, and your phone number.");
    }
}

//====================================================
// screen size & zoom
//====================================================

// screen size changed event handler
$(window).resize(() => {
    setZoom();
});

// set zoom according to visible viewport size
function setZoom() {
    var gameRatio = 1920/1080;
    var screenRatio = window.visualViewport.width/window.visualViewport.height;
    zoom = 100;
    if (screenRatio >= gameRatio) {
        // scale to height
        zoom = 100 * window.visualViewport.height / 1080;
    }
    else {
        // scale to width
        zoom = 100 * window.visualViewport.width / 1920;
    }

    $('#game').css('zoom', `${zoom}%`)

    // lock screen orientation
    if (screen.orientation != undefined) {
        screen.orientation.lock("landscape");
    }
    
}

// Show element in full screen
function openFullscreen() {
    //https://stackoverflow.com/questions/7130397/how-do-i-make-a-div-full-screen
    //https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
    if (document.fullscreenEnabled && (document.fullscreenElement == undefined)) {
        var element = $('html');
        e = element.get(0);
        if (e.requestFullscreen) {
        e.requestFullscreen();
        } else if (e.mozRequestFullScreen) {
        e.mozRequestFullScreen();
        } else if (e.webkitRequestFullscreen) {
        e.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (e.msRequestFullscreen) {
        e.msRequestFullscreen();
        }
    }
}

//====================================================
// html manipulation
//====================================================

// Reads template HTML from the DOM, and returns html with post-fixed ID's
function htmlTemplate(divID, postfix) {
    return replaceAll($(`#${divID}`).html(), '%', postfix);
}

//-------------------------
// Weapons
//-------------------------

// Add a weapon card to the arsenal div
function htmlAddWeapon(weaponID) {
    // Add html from template
    // $('#weaponList').append(htmlTemplate('weapon', weaponID));

    var html = `<div id="weapon${weaponID}" class="weapon" onclick="htmlShowWeaponDetails(${weaponID})">
                    <div class="weaponName">${weapon[weaponID].name}</div>
                    <div class="weaponCost">ZAR ${weapon[weaponID].cost}</div>
                    <div class="weaponSeller">${weapon[weaponID].seller}</div>
                    <div class="weaponText">${weapon[weaponID].text}</div>
                </div>`

    // add weapon html
    $(`#weaponList`).append(html);

    // To do: Set image
}

// Remove weapon
function htmlRemoveWeapon(weaponID) {
    $(`#weapon${weaponID}`).remove();
}

// Show weapon details
function htmlShowWeaponDetails(weaponID) {
    // only allow to buy a weapon if not loaded
    if (!weaponReq) {
        $('#weaponModalCardName').text(weapon[weaponID].name);
        $('#weaponModalCardCost').text(`ZAR ${weapon[weaponID].cost}`);
        $('#weaponModalCardSeller').text(`seller: ${weapon[weaponID].seller}`);
        $('#weaponModalCardText').text(weapon[weaponID].text);

        // Show weapon modal
        $('#weaponModal').css('display', 'block');

        weaponCardID = weaponID;
    }
}

function buyClick() {
    // Set game to full-screen mode
    // openFullscreen();

    // Hide weapon modal
    $('#weaponModal').css('display', 'none');

    // request to buy weapon
    reqBuyWeapon(weaponCardID);
    weaponReq = true;
}

function buyCancel() {
    // Hide weapon modal
    $('#weaponModal').css('display', 'none');
    weaponReq = false;
}

//-------------------------
// Visor
//-------------------------

$(document).mousemove(function(event) {
    if (!isTouch) {
        shot.x = event.pageX / (zoom/100);
        shot.y = event.pageY / (zoom/100);
        if (visorOn) {
            setVisorPosition();
        }
    }
});

function setVisorPosition() {
    // check visor bounds
    var left = 400;
    var right = 350;
    var top = 150;
    var bottom = 25;

    var leftBoundary = left + visor.diameter / 2;
    var rightBoundary = 1920 - right - visor.diameter / 2;
    var topBoundary = top + visor.diameter / 2;
    var bottomBoundary = 1080 - bottom - visor.diameter / 2;

    // verify and adapt shot x and y positions
    if (shot.x < leftBoundary) { shot.x = leftBoundary }
    if (shot.x > rightBoundary) { shot.x = rightBoundary }
    if (shot.y < topBoundary) { shot.y = topBoundary }
    if (shot.y > bottomBoundary) { shot.y = bottomBoundary }

    $("#visor").css("left", shot.x - 300 / 2); // 300 = css width of visor
    $("#visor").css("top", shot.y - 300 / 2); // 300 = css height of visor
}

$(document).on('touchstart', (event) => {
    isTouch = true;
});

$(document).on('touchmove', (event) => {
    if (visorOn) {

        shot.x = event.touches[0].clientX / (zoom/100);
        shot.y = event.touches[0].clientY / (zoom/100);

        setVisorPosition();
    }
});

// visor onclick event handler
function shoot(e) {
    // Set game to full-screen mode
    // openFullscreen();

    // hide visor
    $("#visor").css('display', 'none');

    weaponReq = false;
    visorOn = false;

    // Request to shoot from the server
    reqShoot();

    // reset touch detected
    isTouch = false;
}

//-------------------------
// Victory
//-------------------------
function showVictory(victory, showName) {
    var id = victoryCount;

    // Add victory from template
    $('#victoryList').append(htmlTemplate('victory', victoryCount));
    $(`#victory${id}`).css('left', victory.x - victory.diameter / 2);
    $(`#victory${id}`).css('top', victory.y - victory.diameter / 2);
    $(`#victory${id}`).css('height', victory.diameter);
    $(`#victory${id}`).css('width', victory.diameter);
    $(`#victoryCircle${id}`).css('opacity', victory.opacity);
    $(`#victory${id}`).show();

    if (showName) {
        // set name
        $(`#victoryName${id}`).text(victory.playerName);
        $(`#victoryName${id}`).show();
        // hide name after 5 seconds
        setTimeout(() => {
            $(`#victoryName${id}`).text('');
        }, 5000);
    }

    victoryCount++;
}

//====================================================
// general
//====================================================

function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

