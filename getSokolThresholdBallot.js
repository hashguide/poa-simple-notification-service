const yaml = require('js-yaml');
var fs = require('fs');
var log4js = require('log4js');
var Queue = require('~/poa-simple-notification-service/mq.js') ;
var q = new Queue('~/poa-simple-notification-service/mq.db');
var blockFile = '~/poa-simple-notification-service/sokol_threshold_block';


log4js.configure({
    appenders: { sokol_threshold: { type: 'file', filename: '~/poa-simple-notification-service/sokol/logs/sokol_threshold.log' } },
    categories: { default: { appenders: ['sokol_threshold'], level: 'debug' } }
  });
var logger = log4js.getLogger('sokol_threshold');

var block = fs.readFileSync(blockFile, 'utf-8');

var endBlock = block;

let config = yaml.safeLoad(fs.readFileSync('~/poa-simple-notification-service/email-local.yaml', 'utf8'));

const POA_ABI = require('~/poa-simple-notification-service/sokol/abis/VotingToChangeMinThreshold.abi.json');
const Web3 = require('web3');
const sokol = 'https://sokol.poa.network'
const provider = new Web3.providers.HttpProvider(sokol);
const web3 = new Web3(provider);
const CONTRACT_ADDR = '0xD75ad6E3840A18DaCC67bF3Cd2080B24be409F79';
const poa = new web3.eth.Contract(POA_ABI, CONTRACT_ADDR );

function wait( waitmillis ){ logger.debug("waited [" + waitmillis/1000 + "] seconds."); }

function updateEndBlock( endBlock, blockFile ) {
    fs.writeFile(blockFile, endBlock , function(err)
    {
        if ( err ) { return logger.debug(err); } 
        else logger.debug("start block is now: " + ( endBlock) );  
    } );
    logger.debug("done");
}

logger.debug("\n ---------------------------\n");
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
    logger.debug("Found [" + events.length + "] new ballots.");
    if ( events.length <= 0 ) { 
        web3.eth.getBlockNumber().then( function(value) { 
            updateEndBlock( ++value, blockFile );
        } );
    } else  {       
        events.forEach( ( e ) => { 
            endBlock = e.blockNumber; 
            var p1 = poa.methods.BallotInfo(e.returnValues.id).call().then( 
                resp => {
                    for (const toEmail of config.core_validators ) { 
                        logger.debug( 'block: >>>>>>>>>' + endBlock + ", email: " + JSON.stringify(toEmail) );
                        q.add( 'core',endBlock, CONTRACT_ADDR, e.returnValues.id, JSON.stringify(toEmail), JSON.stringify(resp) );
                        logger.debug("contractAddress [" + CONTRACT_ADDR + "], ballotId[" + e.returnValues.id + "]: " + resp.memo );                       
                    }
                }
             );    
          } );
          
          if ( block != endBlock ) endBlock++;
          updateEndBlock(endBlock, blockFile );
    } 
   
} );

//setTimeout(wait, 60000, 60000 );
