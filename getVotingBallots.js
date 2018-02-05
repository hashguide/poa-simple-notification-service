var fs = require('fs');
var log4js = require('log4js');
log4js.configure({
    appenders: { voting: { type: 'file', filename: 'votingBallots.log' } },
    categories: { default: { appenders: ['voting'], level: 'debug' } }
  });
var logger = log4js.getLogger();
var block = fs.readFileSync('block', 'utf-8');
var endBlock = block;
var memo = "yada";

const POA_ABI = require('./voting.json');
const Web3 = require('web3');
const sokol = 'https://sokol.poa.network'
const provider = new Web3.providers.HttpProvider(sokol);
const web3 = new Web3(provider);
const poa = new web3.eth.Contract(POA_ABI, '0xc40cdf254a4a35498aa84f35e9842c110729a2a0');


logger.debug("\n -------------------------\n");
logger.debug("from block: " + block );

/*
function getMemo(id) {
    logger.debug("id: " + id );
     poa.methods.getMemo(id).call().then( function(response) { memo = response.data; } );
     return memo;
}
*/

poa.getPastEvents('BallotCreated',{
    fromBlock: block 
}, function(error, events){ events.forEach((e) => { 
      logger.debug(e.event,'(', e.blockNumber, ') -- ', e  ); 
      endBlock = e.blockNumber; 
      logger.debug('\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
      var p1 = poa.methods.votingState(e.returnValues.id).call().then( 
          resp =>  logger.debug("ballotId[" + e.returnValues.id + "]: " + JSON.stringify( resp ) )
       );    
    } )  } )
.then(function(events){
 //   console.log(events) // same results as the optional callback above
 if ( block != endBlock ) endBlock++;
// Uncomment the following to persistently store lastest block to disk.
/* 
 s.writeFile("block", endBlock , function(err)
 {
    if ( err ) { return console.log(err); } 
     //console.log("start block is now: " + ( endBlock) );  } );
*/ 
console.log("done");
});






