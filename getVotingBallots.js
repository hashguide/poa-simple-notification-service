var fs = require('fs');
var log4js = require('log4js');
var Queue = require('./mq.js') ;
var q = new Queue('./mq.db') ;
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

q.on('open',function() {
    console.log('Opening SQLite DB') ;
    console.log('Queue contains '+q.getLength()+' job/s') ;
}) ;
 
q.on('add',function(task) {
    console.log('Adding task: '+JSON.stringify(task)) ;
    console.log('Queue contains '+q.getLength()+' job/s') ;
}) ;

//open connection to our queuec
q.open( )
.then(function() {
})
.catch(function(err) {
    console.log('Error occurred:') ;
    console.log(err) ;
    process.exit(1) ;
});

poa.getPastEvents('BallotCreated',{
    fromBlock: block 
}, function(error, events){ 
    if ( events.length > 0 ) {}
    logger.debug("Found [" + events.length + "] new ballots.");
    if ( events.length > 0 ) {
        events.forEach( ( e ) => { 
            endBlock = e.blockNumber; 
            var p1 = poa.methods.votingState(e.returnValues.id).call().then( 
                resp => {  q.add( JSON.stringify(resp) );
                logger.debug("ballotId[" + e.returnValues.id + "]: " + resp.memo )
                }
             );    
          } ) 
    } 
} )
.then(function(events){
 if ( block != endBlock ) endBlock++;
// Comment to not persistently store latest block to disk
//or uncomment the following to persistently store lastest block to disk.
///*
 fs.writeFile("block", endBlock , function(err)
 {
    if ( err ) { return console.log(err); } 
     console.log("start block is now: " + ( endBlock) );  
 } );
console.log("done");
///*

});