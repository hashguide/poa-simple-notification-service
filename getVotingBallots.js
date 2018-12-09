const yaml = require('js-yaml');
var fs = require('fs');
var log4js = require('log4js');
var Queue = require('./mq.js') ;
var q = new Queue('./mq.db');



log4js.configure({
    appenders: { voting: { type: 'file', filename: 'voting.log' } },
    categories: { default: { appenders: ['voting'], level: 'debug' } }
  });
var logger = log4js.getLogger('voting');

var block = fs.readFileSync('block-voting-keys', 'utf-8');

var endBlock = block;

let config = yaml.safeLoad(fs.readFileSync('./email.yaml', 'utf8'));

const POA_ABI = require('./voting.json');
const Web3 = require('web3');
const sokol = 'https://sokol.poa.network'
const provider = new Web3.providers.HttpProvider(sokol);
const web3 = new Web3(provider);
const CONTRACT_ADDR = '0xB974DF531c1b27324618175B442edF95f7F7a621';
const poa = new web3.eth.Contract(POA_ABI, CONTRACT_ADDR );

function wait( waitmillis ){ logger.debug("waited [" + waitmillis/1000 + "] seconds."); }

logger.debug("\n -------------------------\n");
logger.debug("from block: " + block );


q.on('open',function() {
    logger.debug('Opening SQLite DB') ;
    logger.debug('Queue contains '+q.getLength()+' job/s') ;
}) ;
 
q.on('add',function(task) {
    logger.debug('Adding task: '+JSON.stringify(task)) ;
    logger.debug('Queue contains '+q.getLength()+' job/s') ;
}) ;

//open connection to our queuec
q.open( )
.then(function() {
})
.catch(function(err) {
    logger.debug('Error occurred:') ;
    logger.debug(err) ;
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
            var p1 = poa.methods.BallotInfo(e.returnValues.id).call().then( 
                resp => {
                    for (const toEmail of config.sokol_validators ) { 
                        logger.debug( 'block: >>>>>>>>>' + endBlock + ", email: " + JSON.stringify(toEmail) );
                        q.add( 'sokol',endBlock, CONTRACT_ADDR, e.returnValues.id, JSON.stringify(toEmail), JSON.stringify(resp) );
                        logger.debug("contractAddress [" + CONTRACT_ADDR + "], ballotId[" + e.returnValues.id + "]: " + resp.memo );                       
                    }
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
 fs.writeFile("block-voting-keys", endBlock , function(err)
 {
    if ( err ) { return logger.debug(err); } 
     logger.debug("start block is now: " + ( endBlock) );  
 } );
logger.debug("done");
///*

});

setTimeout(wait, 60000, 60000 );
