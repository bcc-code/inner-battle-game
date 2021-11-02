//====================================================
// External libraries
//====================================================

var socket = io(); // Socket.io communication

//====================================================
// Variables
//====================================================

var regex = /^([a-zA-Z0-9\s_\\.\-:])+(.csv|.txt)$/;

// game data
var game = {
    id      : undefined,    // The game id is used as the socket.io room (see https://socket.io/docs/v4/rooms/) enabling a multi-tenant setup
    password: undefined,    // game password used only for game manager login
    settings: undefined,    // game settings received from server / sent to server
};

//====================================================
// socket.io communication
//====================================================

// socket.io connection event
socket.on('connect', () => {

});

// Request authentication. To request a new game, leave the game ID blank
function reqAuth(id, password) {
    // store gameID and password
    game.id = id;
    game.password = password;
    
    // request authentication from server
    socket.emit('reqAuth', id, password);
}

// Receive game ID on successful authentication, and show game settings.
socket.on('authSuccess', (id) => {
    game.id = id;

    $('#loginError').text("Login successful!");

    // Hide the login modal
    $('#loginModal').css('display', 'none');

    // show the settings div
    $('#settings').css('display', 'block');

    // show game ID
    $('#gameIDLabel').text(`Game ID: ${game.id}`);
});

// Clear game ID on failed authentication, and show the login div
socket.on('authFail', (message) => {

    // show the login modal
    $('#loginModal').css('display', 'block');

    // hide the settings div
    $('#settings').css('display', 'none');

    // error text
    $('#loginError').css('color', 'red');
    $('#loginError').text(message);

    // clear game id
    game.id = "";
});

// Request from server to authenticate. Only used if already logged in but connection was interrupted.
socket.on('auth', () => {
    if (game.id != undefined && game.id != "") {
        // Send auth request to server
        socket.emit('reqAuth', game.id, game.password);
    }
});


// Receive game settings from server
socket.on('settings', (settingstable) => {
    // get settings names from settings Object
    $('#settingsTable').html('');
    game.settings = settingstable;
    var settingsNames = Object.keys(game.settings);
    let html = `<table class="settingsTable" >`;
    for (let i = 0;i < settingsNames.length; i++){
        html += `<tr>
                    <td>
                        <span readonly class="settingLabel">${settingsNames[i]}<span>
                    <td/>
                    <td> 
                        <input type="text" id="${settingsNames[i]}" class="input" value="${game.settings[settingsNames[i]]}" />
                    <td/>
                <tr/>`
    }
    html += `<table/>`

    $("#settingsTable").append(html);
});

// Receive updated game totals from server
socket.on('gameData', (data) => {
    if (data != undefined) {
        $('#gameTotals').html(`Game total: ZAR ${data.totalZar} / NOK ${data.totalNok}<br>Credit used: ZAR ${data.totalCreditZar} / NOK ${data.totalCreditNok}`);
    }
});

// Clear settings field on socket disconnect
socket.on('disconnect', (socket) => {
    $('#settingstable').remove();
});

// Submit settings to server
function submitSettings() {
    if (game.id != undefined && game.settings != undefined) {
        socket.emit('settings', game.settings);
    }    
}

// Resets the game data (credits, weapons, etc), but keeps the game settings
function resetGame() {
    socket.emit('reset');
}

//====================================================
// Login
//====================================================

// login / new game button
function loginClick() {
    reqAuth($('#gameID').val(),$('#password').val());
}

// update login button text
function loginChange() {
    if ($('#gameID').val() == undefined || $('#gameID').val() == "") {
        $('#loginButton').text('New game');
    }
    else {
        $('#loginButton').text('Login');
    }
}

//====================================================
// Read credits CSV file and emit to server
//====================================================

function uploadCredits(){
    var confirm = window.confirm("Upload player credits?");

    if (confirm) {
        var file = document.getElementById("creditsUpload");
    
        if (regex.test(file.value.toLowerCase())) {
            if (typeof (FileReader) != "undefined") {
                var reader = new FileReader();
    
                // Handle file reader event
                reader.onload = function (file) {
                    // Player array.
                    // |- name
                    // |- phoneNumber
                    // |- creditZar
                    var player = [];
                
                    // Log of failed lines (string)
                    var failedPlayer = [];

                    // Parse csv using Papa Parse (https://www.papaparse.com/)
                    var csv = Papa.parse(file.target.result);
    
                    // Log failed csv converter lines
                    csv.errors.forEach(e => {
                        failedPlayer.push(e.toString());
                    })
                    
                    // Create player objects
                    csv.data.forEach(l => {
                        var p = newPlayer(l);
                        if (p != false) {
                            player.push(p);
                        }
                        else {
                            // Log failed lines
                            if (l.toString() != "") {
                                failedPlayer.push(l.toString());
                            }
                        }
                    });
                    
                    // Send players to server
                    socket.emit('players', player);

                    if (failedPlayer.length == 0) {
                        window.alert('Imported data successfully sent to server.');
                    }
                    else {
                        var t = "";
                        failedPlayer.forEach(l => {
                            t += l + "\n";
                        });

                        window.alert(`Import completed with errors:\n${t}`);
                    }
                }
    
                // Read file
                reader.readAsText(file.files[0]);
            }
            else {
                alert("This browser does not support HTML5.");
            }
        }
        else {
            alert("Please upload a valid CSV file.");
        }
    }
    
};

// Create a player object for sending to the server. Returns false if csv line could not be converted
function newPlayer(csvLine) {
    // Check if at least 3 columns
    if (csvLine.length >= 3) {
        // Check if third column can be parsed as float
        var credit = tryParseFloat(csvLine[2]);
        if (credit != false) {
            return {
                name        : csvLine[0],
                phoneNumber : csvLine[1],
                creditZar   : credit,
            };
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }
}

//====================================================
// Read versus CSV file and emit to server
//====================================================

function uploadWeapons(){
    var confirm = window.confirm("Upload verses (weapon cards)?");
    
    if (confirm) {
        var file = document.getElementById("weaponsUpload");
    
        if (regex.test(file.value.toLowerCase())) {
            if (typeof (FileReader) != "undefined") {
                var reader = new FileReader();

                // Handle file reader event
                reader.onload = function (file) {
                    // Weapon array
                    var weapon = [];

                    // Log of failed lines (string)
                    var failedWeapon = [];
                    
                    // Parse csv using Papa Parse (https://www.papaparse.com/)
                    var csv = Papa.parse(file.target.result);
    
                    // Log failed csv converter lines
                    csv.errors.forEach(e => {
                        failedWeapon.push(e.toString());
                    })

                    // Create weapon objects
                    csv.data.forEach(l => {
                        var p = newWeapon(l);
                        if (p != false) {
                            weapon.push(p);
                        }
                        else {
                            // Log failed lines
                            if (l.toString() != "") {
                                failedWeapon.push(l.toString());
                            }
                        }
                    });
                        
                             
                    // Send weapons to server
                    socket.emit('weapons', weapon);

                    if (failedWeapon.length == 0) {
                        window.alert('Imported data successfully sent to server.');
                    }
                    else {
                        var t = "";
                        failedWeapon.forEach(l => {
                            t += l + "\n";
                        });

                        window.alert(`Import completed with errors:\n${t}`);
                    }
                }
                
                //  Read file
                reader.readAsText(file.files[0]);
            }
            else {
                alert("This browser does not support HTML5.");
            }
        }
        else {
            alert("Please upload a valid CSV file.");
        }
    }
    
};

// Create a weapon object for sending to the server. Returns false if csv line could not be converted
function newWeapon(csvLine) {
    // Check if at least 3 columns
    if (csvLine.length >= 3) {
    return {
            seller  : csvLine[0],
            name    : csvLine[1],
            text    : csvLine[2],
        };
    }
    else {
        return false;
    }
}

//====================================================
// Reset button
//====================================================

function Reset(){
    var confirm = window.confirm("Are you sure you want to reset the game?");
    if (confirm){
        // Reset game
        resetGame();
    }
}

//====================================================
// Submit button
//====================================================

function Submit(){
    var confirm = window.confirm("Are you sure you want to change this settings?");
    if (confirm){
        var settingsNames = Object.keys(game.settings);
        for (let i = 0;i < settingsNames.length; i++){
            game.settings[settingsNames[i]] = $(`#${settingsNames[i]}`).val();
        }
        
        // submit settings to server
        submitSettings();
    }
}

//====================================================
// General functions
//====================================================

// Returns false if value not parsable. Returns parsed value if parse succeeded
function tryParseFloat(str) {
    // modified from https://pietschsoft.com/post/2008/01/14/javascript-inttryparse-equivalent
    var retValue = false;
    if(str !== null) {
        if(str.length > 0) {
            if (!isNaN(str)) {
                retValue = parseFloat(str);
            }
        }
    }
    return retValue;
}