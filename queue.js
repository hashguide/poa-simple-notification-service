'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const yaml = require('js-yaml');
var log4js = require('log4js');

log4js.configure({
    appenders: { dequeue: { type: 'file', filename: '/home/jhl/dev/poa/poa-simple-notification-service/dequeue.log' } },
    categories: { default: { appenders: ['dequeue'], level: 'debug' } }
  });

var log = log4js.getLogger();

var Queue = require('/home/jhl/dev/poa/poa-simple-notification-service/mq.js') ;
var q = new Queue('/home/jhl/dev/poa/poa-simple-notification-service/mq.db');

let config = yaml.safeLoad(fs.readFileSync('/home/jhl/dev/poa/poa-simple-notification-service/email-local.yaml', 'utf8'));

// Setup Nodemailer transport
let transporter = nodemailer.createTransport( 
    {
        host: config.transport.host,
        port: config.transport.port,
        //secure: account.smtp.secure,
        auth: {
            user: config.transport.auth.user,        
            pass: config.transport.auth.pass
        },
        logger: config.transport.log,
        debug: config.transport.debug // include SMTP traffic in the logs
    },
    {
        // default message fields

        // sender info
        from: config.transport.from,
        headers: {
            'X-Laziness-level': 1000 // just an example header, no need to use this
        }
    }
);
 
q.on('open',function() {
    log.debug('Opening SQLite DB') ;
    log.debug('Queue contains '+q.getLength()+' job/s') ;
}) ;
 
q.on('add',function(task) {
    log.debug('Adding task: '+JSON.stringify(task)) ;
    log.debug('Queue contains '+q.getLength()+' job/s') ;
}) ;
 
q.on('start',function() {
    log.debug('Starting queue') ;
}) ;
 
q.on('next',function(task) {
    try {
        log.debug('Queue contains '+q.getLength()+' job/s') ;
        log.debug('Process task: ') ;
        //log.debug(task) ;

        //reload config

        config = yaml.safeLoad(fs.readFileSync('/home/jhl/dev/poa/poa-simple-notification-service/email-local.yaml', 'utf8'));

        //var  job = task.job.replace(/\\\\n/g, "<br/>");
        //job = job.replace(/\\/g, "");           
        //job = job.substring(1, job.length - 1 );
        var json = JSON.parse(task.job);


        config = yaml.safeLoad(fs.readFileSync('/home/jhl/dev/poa/poa-simple-notification-service/email-local.yaml', 'utf8'));

        //var  job = task.job.replace(/\\\\n/g, "<br/>");
        //job = job.replace(/\\/g, "");           
        //job = job.substring(1, job.length - 1 );
        var json = JSON.parse(task.job);

        // Shape the recipients into an array
        function getRecipients(recipients) {
            
            const to = [];
            
                for (const email in recipients) {
                    const name = recipients[email];
                    const address = name ? `${name} <${email}>` : email;
                    to.push(address);
                } 
            return to;
        }

        var message = config.sokol_validators_message;

        //build the message from the task ....
        let msg = {
            // Comma separated list of recipients
            to: getRecipients( JSON.parse(task.toEmail) ),
            // Subject of the message
            subject: 'POA ' + task.network.toUpperCase() + ' Ballot Id [' + task['ballotId'] + '], created ( beta ).',
            // plaintext body
            text:  message.message_txt 
            + "\n-Network" + task.network + " -- Ballot Id: " + task.ballotId
            + "\n-Description: " + json.memo 
            + "\n-Ballot End Time: " + new Date( json.endTime * 1000 ) 
            + "\n-POA Voting DApp:  https://voting.poa.network/",
            // HTML body
            html:
            "<html><ul>" + message.message_txt 
            + "<li/>Network " + task.network.toUpperCase() + " -- Ballot Id: " + task.ballotId
            + "<li/>Description: " + json.memo 
            + "<li/>Ballot End Time: " + new Date( json.endTime * 1000 ) 
            + "<li/>POA Voting DApp:  https://voting.poa.network/</ul></html>",

            // An array of attachments
            //attachments: [
                // File Stream attachment
                //{
                //    filename: 'nyan cat.gif',
                //    path: __dirname + '/assets/nyan.gif',
                //    cid: 'nyan@example.com' // should be as unique as possible
                //}
            //]
        };
    

        return new Promise(function(resolve,reject) { 

            transporter.sendMail(msg, (error, info) => {
                if (error) {
                    log.debug('Error occurred');
                    log.debug(error.message);
                    reject(error);
                }
                
                log.debug('Message sent successfully!');
                //log.debug(nodemailer.getTestMessageUrl(info));

                // only needed when using pooled connections
                //transporter.close();
                // Must tell Queue that we have finished this task 
                // This call will schedule the next task (if there is one) 
                q.done() ;
                resolve();
            } );

        });
    } catch(e) {
        log.debug('Ouch -- something went wrong, skipping this message with id [' 
            + task.id + ']'); 
        log.error(e);
        q.err();
    }
});


 
// Stop the queue when it gets empty 
q.on('empty',function() {

    log.debug('Queue is empty, i.e. contains '+q.getLength()+' job/') ;

    function waitFor( millis ) { 
        return new Promise(resolve => {
          log.debug('Queue waiting [' + millis/1000  + '] seconds to shutdown');
          setTimeout(() => {
            resolve( millis/1000 );
          }, millis );
        });
      }
      
    async function wait( millis ) {
          await waitFor(millis).then(function(result) {          
            q.stop() ; 
            q.close()
                .then(function() { process.exit(0) ; })
            });
    }
      
    //wait( 300000 );
  
    
}) ;
 
q.on('stop',function() {
    log.debug('Stopping queue') ;
}) ;
 
q.on('close',function() {
    log.debug('Closing SQLite DB') ;
}) ;
 
q.open()
.then(function() {   
    q.start() ;
})
.catch(function(err) {
    log.debug('Error occurred:') ;
    log.debug(err) ;
    process.exit(1) ;
}) ;
