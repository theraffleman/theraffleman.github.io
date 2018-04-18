/* Game class stores and manages all cached games */
class Game {
  constructor(gameData){
    for (var key in gameData) {
      if (gameData.hasOwnProperty(key)) {
          this[key] = gameData[key];
      }
    }
    this._gameDiv = null;
    this.waitingForReceipt = false;
    this.tx = "";
  }

  set gameDiv(_gameDiv) {
    this._gameDiv = _gameDiv;
  }

  updateGameData(gameData){
    for (var key in gameData) {
      if (gameData.hasOwnProperty(key)) {
          this[key] = gameData[key];
      }
    }
  }

  /*
   Creates and returns a div containing all the information regarding this game
   which can then be added to the game container
  */
  get gameDiv() {

    var template = document.getElementById('game_template');

    this._gameDiv = template.cloneNode(true);
    this._gameDiv.id = this.gameID;
    this._gameDiv.getElementsByClassName('game_id')[0].textContent = this.gameID;

    // Get data
    var winnerPrize = web3.fromWei(String(this.maxParticipants * this.entryPrice), 'ether') + " Eth";
    var ticketsLeft = this.maxParticipants - this.currentParticipantCount;
    var currentPot = web3.fromWei(String(this.balance), 'ether') + " Eth";
    var entryPrice = web3.fromWei(String(this.entryPrice), 'ether') + " Eth";
    var megaRaffleBonus = web3.fromWei(String(this.megaBonus), 'ether');
    
    // Figure out expiration date for the raffle
    var drawingDate = new Date(this.expirationDate.toNumber()*1000);
    var now = Date.now();

    var timeDiff = drawingDate.getTime() - now;
    var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // If expired, allow user to get random number for that raffle
    // If more than one day left, print date
    // If less than one day, print time
    if(diffDays <= 0){
      this._gameDiv.getElementsByClassName('help_button')[0].style.display = "inline";
      drawingDate = "Expired";
    }else if(diffDays > 1){
      drawingDate = drawingDate.toLocaleString().substr(0,9);
    } else {
      drawingDate = drawingDate.toLocaleString().substr(10, drawingDate.toLocaleString().length);
    }

    // change div data
    this._gameDiv.getElementsByClassName('payout')[0].innerHTML = winnerPrize;
    // this._gameDiv.getElementsByClassName('current_prize')[0].innerHTML = currentPot;
    this._gameDiv.getElementsByClassName('tickets_left')[0].innerHTML = ticketsLeft + "/" + this.maxParticipants;
    this._gameDiv.getElementsByClassName('price_banner')[0].textContent = entryPrice;
    this._gameDiv.getElementsByClassName('expiration_date')[0].textContent = drawingDate;
    this._gameDiv.getElementsByClassName('mega_raffle_bonus')[0].textContent = megaRaffleBonus + " Ticket" + (megaRaffleBonus == 1 ? "" : "s");

    var buyTicketButton = this._gameDiv.getElementsByClassName('ticket_button')[0];

    // Dont append the buyTicketButton if game is full or if it is diabled              
    if(!this.isActive)
      this._gameDiv.innerHTML += "<h3>Game Disabled</h3>";
    else if(ticketsLeft > 0)
      if(this.waitingForReceipt){
        var etherscanLink = gameDiv.getElementsByClassName('etherscan_link')[0];
        etherscanLink.style.display = "block";
        etherscanLink.href = "https://"+currentNetwork+".etherscan.io/tx/"+this.tx;
      } else 
        buyTicketButton.style.display = 'inline';
    else{
      let lastQueryTime = new Date(this.lastQueryTime.toNumber()*1000);
      let timeToNextQuery = lastQueryTime.getTime()+300000;
      let timeDiff = Math.max(0, timeToNextQuery - now);

      this._gameDiv.innerHTML += "<h3 style='margin-bottom:0px;'>Picking Winner...</h3>"; // TODO show something more informative
      setTimeout(() => {
        this._gameDiv.innerHTML += "<p style='color:red;padding:0px;margin:0px;'><sub>Taking too long? Oraclize failed? Try ending the round again</sub></p>"
      }, timeDiff);
    }

    // this._gameDiv.appendChild(miniTicket);
    
    return this._gameDiv;
  }

} // end class Game

// global lottery object representing the contract
// and all it's functions.
var lottery;
// global object holding all the games loaded from the blockchain
var games = {};
var megaRaffle;

/*  Loads the web3 context  */
window.addEventListener('load', function() {
  // document.getElementById('modal').style.display = "block";
  // document.getElementById('accept_terms_modal').display = 'block';

  currentNetwork = null;

  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    // Use Mist/MetaMask's provider
    web3js = new Web3(web3.currentProvider);
  } else {
    alert('you must have metamask installed');
    // use localhost (testrpc)
    web3js = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  // log eth network
  web3js.version.getNetwork((err, netId) => {
    switch (netId) {
      case "1":
        currentNetwork = 'mainnet';
        break;
      case "2":
        currentNetwork = 'the deprecated Morden test network.';
        break;
      case "3":
        currentNetwork = 'ropsten';
        break;
      case "4":
        currentNetwork = 'rinkeby';
        break;
      case "42":
        currentNetwork = 'kovan';
        break;
      default:
        currentNetwork = 'unknown';
    }
    document.getElementById('result').innerHTML = "You are on the " + currentNetwork + " test network.";
  })


  var lotteryContract;  
  lotteryContract = web3js.eth.contract(contractABI);
  lottery = lotteryContract.at(address);

  showModals('accept_terms_modal');
  loadAllGames();
  displayUserInfo();
  getDailyMegaAward();

  // Get the main modal
  var modal = document.getElementById("modal");
  // Get the <span> element that closes the modal
  var span = document.getElementsByClassName("close")[0];
  // When the user clicks on <span> (x), close the modal
  span.onclick = function() {
    modal.style.display = "none";
    clearAllModals();
  }
  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {

    // close any open modals
    if (event.target == modal) {
      clearAllModals();
    }

    // close any open expired_game_hints
    if (event.target.className == "close" && event.target.parentNode.className == "end_expired_game_hint"){
      event.target.parentNode.style.display = "none";
    }

    // close the menu on mobile
    var menu = document.getElementById("menu");
    if (menu.className.includes("responsive") && (event.target.tagName != "A" && event.target.className != "close")){
      showMenu();
    }

    // close the mega raffle on mobile
    var mega = document.getElementById("mega_raffle");
    if (mega.className.includes("responsive") && event.target.tagName != "A"){
      let e = event.target;
      
      while (e.id != "mega_raffle" && (e = e.parentNode) && e.tagName != "HTML") ;
      if(e.id != "mega_raffle") showMega();      
    }
  }

  // Watch blockchain for events
  window.setTimeout(function () {
    pollForEvents()
  }, 5000);
});


/*
  Loads all the games from the blockchain and displays them on the homepage 
*/
function loadAllGames(){
  // The names for the return values of showGameInfo function from Lottery contract
  var labels = getReturnValueLabels('showGameInfo');
  // Main container holding all the games
  var section = document.getElementById('main_content');

  /* 
    This is how we load all the games that were created from time of contract creation
    The solidity event that we are watching for is LogGameCreated. We then use the indexed argument
    _gameID which will give us all the gameID values that were emmitted from this contract. 
    The `fromBlock: 0, toBock: latest` is necessary because watching for an event only begins watchin
    at time of activation.
  */
  var createGameEvent = lottery.LogGameCreated({_gameID: 'gameID'}, {fromBlock: 0, toBlock: 'latest'});
  createGameEvent.get(function(error, result) {
    if (error) {
      console.log(error);
      return;
    }

    result.forEach(game => {

      var gameID = game.args['gameID'].toNumber();
      if (games[gameID]) {
        return;
      }

      // Populate the game container with data
      // Gets the data from the blockchain and populates using a callback
      getGameData(gameID, function(result){      
        
        // Process megaRaffle differently than other games
        if (gameID === 0){
          megaRaffle = result;
          displayMegaRaffle();
          return;
        }

        // create a new game object 
        var gameObj = new Game(result);

        // append new game object to global games array
        games[gameID] = gameObj;

        // Dont display game if it is disabled
        if(!gameObj.isActive) return; 
    
        var gameDiv = gameObj.gameDiv;      

        // Which group does the new game belong in (based on entry price)
        var gameContainer = document.getElementById("game_container");

        // Sort the new game into position in the group
        // Sorting happens in two stages, first by entry price then by max participants
        var descendants = gameContainer.getElementsByClassName('game');
        for (var i = 0; i < descendants.length; i++) {
          var id = descendants[i].id;
          if (gameObj.entryPrice.toNumber() <= games[id].entryPrice.toNumber()){
            for (var j = i; j < descendants.length; j++){
              id = descendants[j].id;
              if (gameObj.maxParticipants.toNumber() > games[id].maxParticipants.toNumber()
               && gameObj.entryPrice.toNumber() == games[id].entryPrice.toNumber())
                continue;
              
              gameContainer.insertBefore(gameDiv, descendants[j]); 
              return;
            }
          }
        }
        // only happens if new game is sorted to the end of gameContainer
        gameContainer.appendChild(gameDiv);      
      });
    });
  });
}


/* Fills in data for Mega Raffle */
function displayMegaRaffle() {
  var currentPrize = web3.fromWei(String(megaRaffle['balance']), 'ether') + " Eth";

  document.getElementById("mega_raffle_prize").innerHTML = currentPrize;
  document.getElementById("mega_raffle_entries").innerHTML = megaRaffle['currentParticipantCount'];

  var drawingDate = new Date(megaRaffle['expirationDate'].toNumber()*1000);

  var now = Date.now();

  var timeDiff = drawingDate.getTime() - now;
  var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

  // If expired, allow user to get random number for that raffle
  // If more than one day left, print date
  // If less than one day, print time
  if(diffDays <= 0){
    drawingDate = "Round Over";
    document.getElementById('mega_raffle_notice').style.display = 'block';
  }else if(diffDays > 1){
    drawingDate = drawingDate.toLocaleString().substr(0,9);
  } else {
    drawingDate = drawingDate.toLocaleString().substr(10, drawingDate.toLocaleString().length);
  }

  document.getElementById("mega_raffle_drawing").innerHTML = drawingDate;
}


// checks the daily award for participating in any raffle
function getDailyMegaAward() {
  lottery.dailyTicketAward( function(error, result){
    if(error){
      console.error(error);
      return;
    }
    var val = web3js.fromWei(String(result.toNumber()), 'ether');
    document.getElementById('daily_mega_award').textContent = val; // + " Mega Raffle Ticket" + (Number(val) == 1?"":"s") + "!";
  });
}

function shouldShowHowToPlay(){
  clearAllModals();

  // lottery.getLastTicketPurchaseTime( function(error, result){
  //   if(error){
  //     console.error(error);
  //     return;
  //   }
  //   if (result.toNumber() == 0)
  //     showModals('show_help_btn');
  // });
}

/*****************
  Raffle contract functions
/*****************

/* Should show user data like balances, free games, games won....*/
function displayUserInfo() {

  // Display shortened user address
  var address = String(web3js.eth.coinbase);
  address = address.slice(0,6) + '...' + address.slice(-4) + '\n';
  document.getElementById("eth_address").textContent = address;

  checkPendingWithdrawals();
  checkMegaRaffleBalance();
}


function checkPendingWithdrawals() {
  // Show pending withdrawals and withdraw button ONLY if there is a balance
  var pendingWithdrawals = document.getElementById("pending_withdrawals");
  var withdrawButton = document.getElementById("withdraw_btn");
  lottery.getPendingWithdrawals( function(error, result){
    if(error){
      console.error(error);
      return;
    }
    amount = web3js.fromWei(String(result.toNumber()), 'ether') + " Ξ";
    pendingWithdrawals.textContent = amount;
  });
}

/*
  Checks the users mega raffle ticket balance
*/
function checkMegaRaffleBalance() {
  var address = String(web3js.eth.coinbase);
  lottery.balanceOf(address, function(error, result){
    if(error){
      console.log(error);
      return;
    }

    var megaTickets = web3js.fromWei(String(result.toNumber()), 'ether');
    document.getElementById('mega_tickets_available').innerHTML = megaTickets;
  });
}

/*
  Calls the contracts withdraw function with the users address
*/
function withdrawEther() {
  lottery.withdraw.sendTransaction({from: web3js.eth.coinbase}, function(error, result){
    if (error) {
      console.log(error);
      return;
    }
    console.log(result)
  });
}

/*
  Reads the number of tickets the user wants to enter the mega raffle with and uses metamask
  to interact with the blockchain
*/
function enterMegaRaffle() {
  var ticketsToUse = document.getElementById('mega_tickets_to_use').value;
  var callData = {from:web3js.eth.coinbase, gasPrice: 2000000000};
  console.log(ticketsToUse);
  lottery.enterMegaLotto.estimateGas(ticketsToUse, callData, function(error, result){
    if (error){
      console.log(error);
      return;
    }
    // add gas estimate to callData
    callData['gas'] = result;
    lottery.enterMegaLotto.sendTransaction(ticketsToUse, callData, function(error, result){
      if (error){
        console.log(error);
        return;
      }

      waitForReceipt(result, function(receipt){
        getGameData(0, function(gameData){
          megaRaffle = gameData;
          displayMegaRaffle();
        });
      });
    });
  });
}

/*
  Interacts with the blockchain. Uses metamask to send a transaction to buy 
  a ticket to the selected game. The gameID is that of the button that was clicked
*/ 
function buyTicket(parentNode){
  var gameID = parentNode.id;
  var gameSelected = games[gameID];
  var callData = {from:web3js.eth.coinbase, value: gameSelected['entryPrice'], gasPrice: 2000000000};

  lottery.buyTicket.estimateGas(gameID, callData, function(error, result){
    if (error){
      console.log(error);
      return;
    }
    // add gas estimate to callData
    callData['gas'] = result;
    lottery.buyTicket.sendTransaction(gameID, callData, function(error, result){
      if (error){
        console.log(error);
        return;
      }

      gameSelected.waitingForReceipt = true;
      gameSelected.tx = result;

      var gameDiv = document.getElementById(gameID);
      gameDiv.getElementsByClassName('ticket_button')[0].style.display = 'none';
      
      var etherscanLink = gameDiv.getElementsByClassName('etherscan_link')[0];
      var link = "http://"+ (currentNetwork=="mainnet"?"":currentNetwork+".")+"etherscan.io/tx/"+result;

      etherscanLink.style.display = "block";
      etherscanLink.href = link;

      waitForReceipt(result, function(receipt) {
        gameSelected.waitingForReceipt = false;
        checkPendingWithdrawals();
        checkMegaRaffleBalance();
        getGameData(gameID, function(gameData){
          gameSelected.updateGameData(gameData);
          document.getElementById(gameID).innerHTML = gameSelected.gameDiv.innerHTML;
        });
      });
    });
  });
}

/* Ends an expired game by getting a new random number */
function endExpiredGame(node){
  // Get the main parent (game div) with the correct gameID
  var gameNode = node.parentNode.parentNode.parentNode.parentNode;

  // get the random number for the game
  getRandomNumber(gameNode.id, function(result){

    waitForReceipt(result, function(receipt) {
      console.log(receipt);
      gameNode.getElementsByClassName('end_expired_game_hint')[0].style.display = 'none';
    });
  });

  // Hide the game hint
}

/* Requests a random number from oraclize */
function getRandomNumber(gameID, cb){  
  var callData = {from:web3js.eth.coinbase, gasPrice: 2000000000};
  
  lottery.getRandomNumber.estimateGas(gameID, callData, function(error, result){
    if (error){
      console.log("gas estimate error");
      alert('A random number was just requested. Please wait.');
      return;
    }
    // add gas estimate to callData
    callData['gas'] = result;
    lottery.getRandomNumber.sendTransaction(gameID, callData, function(error, result){
      if (error){
        console.log(error);
        return;
      }
      cb(result);
    });
  });
}


/* Shows the appropriate modal when the corresponding button is clicked */
function showModals(clicked_or_id){
  document.getElementById('modal').style.display = "block";
  switch (clicked_or_id){
    case "show_help_btn":
      document.getElementById("how_to_play_modal").style.display ="block";
      break;
    case "show_game_history_btn":
      document.getElementById("game_history_modal").style.display ="block";
      getGameHistory();
      break;
    case "show_smart_contract_btn":
      document.getElementById("smart_contract_modal").style.display ="block";
      break;
    case "show_player_info_btn":
      document.getElementById("player_info_modal").style.display ="block";
      getPlayerHistory();
    case 'accept_terms_modal':
      break;
    default:
      document.getElementById(clicked_or_id).style.display = "block";
      break;
  }
}

/* Hides all the unused modals */
function clearAllModals(){
  modal.style.display = "none";
  var modals = document.getElementsByClassName("modal-content");
  for (var i = 0; i < modals.length; i++){
    modals[i].style.display = "none";
  }
}

/* When a user clicks on the show hint button (q mark) */
function showEndExpiredGameHint(node){
  var container = node.parentNode.parentNode.parentNode;
  var hint = container.getElementsByClassName("end_expired_game_hint")[0];
  hint.style.display = "block";

}

/*
  Query Ethereum blockchain for all the winning games.
  Gets called when a user requests game history
*/
var lastBlockSearch = 0;
function getGameHistory(){

  // Eventually limit history length
  // lastBlockSearch = web3.eth.blockNumber - 100000;

  var gameHistoryTable = document.getElementById("game_history_table");
  var foundWinnerEvent = lottery.LogFoundWinner({},{fromBlock: lastBlockSearch, toBlock: 'latest'})
  
  foundWinnerEvent.watch(function(error, result){
    if(error){
      console.log(error);
      return;
    }

    lastBlockSearch = result.blockNumber > lastBlockSearch ? result.blockNumber+1 : lastBlockSearch;
    var link = "http://"+ (currentNetwork=="mainnet"?"":currentNetwork+".")+"etherscan.io/tx/"+result.transactionHash;

    var tr = gameHistoryTable.insertRow(1);
    tr.innerHTML =  "<td><a target='_blank' href='"+link+"'>" + result.blockNumber + "</a></td>" +
                    "<td>" + result.args.gameID.toNumber() + "</td>" +
                    "<td>" + result.args.roundNumber + "</td>" + 
                    "<td>" + result.args.winningPosition + "</td>" +
                    "<td>" + web3js.fromWei(String(result.args.amountWon.toNumber()), 'ether') + " Ξ</td>" +
                    "<td>" + result.args.winner + "</td>";
                    
  });
}

/*
  Query Ethereum blockchain for tickets bought and games won for a specific user.
  Creates the table on the first time and then appends with every request.

  This should be using `get` instead of `watch` events. We dont want to listen, 
  only read when user requests info. Subscribe to multiple events.

  Gets called when a user requests game history
*/
var lastPlayerBlockSearch = 0;
var ticketsBought = 0;
var etherWagered = 0;
var etherWon = 0;
function getPlayerHistory(){
  var gameHistoryTable = document.getElementById("player_games_history_table");
  var ticketSoldEvent = lottery.LogTicketSold({user:web3js.eth.coinbase},{fromBlock: lastPlayerBlockSearch, toBlock: 'latest'})
  
  ticketSoldEvent.watch(function(error, result){
    if(error){
      console.log(error);
      return;
    }
    lastPlayerBlockSearch = result.blockNumber > lastPlayerBlockSearch ? result.blockNumber+1 : lastPlayerBlockSearch;

    ticketsBought += 1;
    etherWagered += result.args.price.toNumber();
    document.getElementById('num_tickets_bought').textContent = ticketsBought;
    document.getElementById('eth_wagered').textContent = web3js.fromWei(String(etherWagered), 'ether') + " Ξ";

    var link = "http://"+ (currentNetwork=="mainnet"?"":currentNetwork+".")+"etherscan.io/tx/"+result.transactionHash;
    var tr = gameHistoryTable.insertRow(1);
    tr.innerHTML = "<td><a target='_blank' href='"+link+"'>" + result.blockNumber + "</a></td>" +
                    "<td>" + result.args.gameID.toNumber() + "</td>" +
                    "<td>" + result.args.roundNumber + "</td>" + 
                    "<td>" + result.args.ticketPosition + "</td>" +
                    "<td>" + web3js.fromWei(String(result.args.price.toNumber()), 'ether') + " Ξ</td>";

  });


  var winHistoryTable = document.getElementById("player_win_history_table");
  var foundWinnerEvent = lottery.LogFoundWinner({winner:web3js.eth.coinbase},{fromBlock: lastPlayerBlockSearch, toBlock: 'latest'})
 
  foundWinnerEvent.watch(function(error, result){
    if(error){
      console.log(error);
      return;
    }
    lastPlayerBlockSearch = result.blockNumber > lastPlayerBlockSearch ? result.blockNumber+1 : lastPlayerBlockSearch;

    etherWon += result.args.amountWon.toNumber();
    document.getElementById('eth_won').textContent = web3js.fromWei(String(etherWon), 'ether') + " Ξ";

    var link = "http://"+ (currentNetwork=="mainnet"?"":currentNetwork+".")+"etherscan.io/tx/"+result.transactionHash;
    var tr = winHistoryTable.insertRow(1);
    tr.innerHTML = "<td><a href="+link+">" + result.blockNumber + "</a></td>" +
                    "<td>" + result.args.gameID.toNumber() + "</td>" +
                    "<td>" + result.args.roundNumber + "</td>" + 
                    "<td>" + result.args.winningPosition + "</td>" +
                    "<td>" + web3js.fromWei(String(result.args.amountWon.toNumber()), 'ether') + " Ξ</td>";

  });
}


/* Changes the player history view between games played and games won */
function changePlayerHistoryView(nodeID){  
  switch (nodeID){
    case "games_played_btn":
      document.getElementById('player_games_history_table').style.display = 'table';
      document.getElementById('games_played_btn').className = 'active';
      document.getElementById('player_win_history_table').style.display = 'none';
      document.getElementById('games_won_btn').className = '';
      break;
    case "games_won_btn":
      document.getElementById('player_win_history_table').style.display = 'table';
      document.getElementById('games_won_btn').className = 'active';
      document.getElementById('player_games_history_table').style.display = 'none';
      document.getElementById('games_played_btn').className = '';
      break;
  }
}


/* 
  Retrieves the game info, packs it into a JSON object with the proper 
  labels and uses the callback to process the result for the game 
*/
function getGameData(_gameID, callback){
  var labels = getReturnValueLabels('showGameInfo');
  var res = lottery.showGameInfo(_gameID, function(error, result){
    if(error){
      console.log(error);
      return;
    }
    var resultsObj = {

    };
    result.forEach((e, i) => resultsObj[labels[i]] = e);
    callback(resultsObj);
  });  
}

/*
  Checks for foundWinnerEvents and ticketSoldEvents in order to update game data
*/
function pollForEvents(){
  var foundWinnerEvent = lottery.LogFoundWinner();
  var ticketBoughtEvent = lottery.LogTicketSold();

  // When a winner is found for a given raffle
  foundWinnerEvent.watch(function(error, result){
    if(error){
      console.log(error);
      return;
    }

    // Update game that just ended
    var gameID = result.args.gameID.toNumber();

    // Update info if it was a regular game
    if (gameID != 0){
      getGameData(gameID, function(gameData){
        games[gameID].updateGameData(gameData);
        document.getElementById(gameID).innerHTML = games[gameID].gameDiv.innerHTML;
      });
    }

    // Update mega lotto info
    getGameData(0, function(gameData){
      megaRaffle = gameData;
      displayMegaRaffle();
    })
  });

  // When a ticket is bought for a given raffle
  ticketBoughtEvent.watch(function(error, result){
    if(error){
      console.log(error);
      return;
    }

    var gameID = result.args.gameID.toNumber();
    getGameData(gameID, function(gameData){
      games[gameID].updateGameData(gameData);
      document.getElementById(gameID).innerHTML = games[gameID].gameDiv.innerHTML;
    });
  });

}

/*
  Waits for a receipt verifying transaction was mined
*/
function waitForReceipt(hash, callback) {
  console.log(hash);
  web3.eth.getTransactionReceipt(hash, function (err, receipt) {
    if (err) {
      error(err);
    }

    if (receipt !== null) {
      // Transaction went through
      if (callback) {
        callback(receipt);
      }
    } else {
      // Try again in 1 second
      window.setTimeout(function () {
        waitForReceipt(hash, callback);
      }, 1000);
    }
  });
}

/* Returns the labels for the return values */
function getReturnValueLabels(methodName){
  var returnLabels = [];  
  contractABI.forEach(function(element){
    if(element['name'] === methodName){
      element['outputs'].forEach(output => returnLabels.push(output['name']));
    }
  });
  return returnLabels;
}

