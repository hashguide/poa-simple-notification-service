'use strict';

const nodemailer = require('nodemailer');
//var log4js = require('log4js');
//var logger = log4js.getLogger();
//logger.level = 'debug';

// Setup Nodemailer transport
let transporter = nodemailer.createTransport(
    {
        host: 'smtp.gmail.com',
        port: 587,
        //secure: account.smtp.secure,
        auth: {
            user: 'jlegassic@gmail.com',        
            pass: 'lzzatqbcvsjuxhyw'
        },
        logger: true,
        debug: true // include SMTP traffic in the logs
    },
    {
        // default message fields

        // sender info
        from: 'jlegassic@gmail.com',
        headers: {
            'X-Laziness-level': 1000 // just an example header, no need to use this
        }
    }
);
    

var Queue = require('./mq.js') ;
var q = new Queue('./mq.db') ;

 
var task1 = {
    data: "Data1"
} ;
var task2 = {
    data: "Data2"
} ;
var task3 = {
    data: "Data3"
} ;
var task4 = {
    data: "Data4"
} ;



 
q.on('open',function() {
    console.log('Opening SQLite DB') ;
    console.log('Queue contains '+q.getLength()+' job/s') ;
}) ;
 
q.on('add',function(task) {
    console.log('Adding task: '+JSON.stringify(task)) ;
    console.log('Queue contains '+q.getLength()+' job/s') ;
}) ;
 
q.on('start',function() {
    console.log('Starting queue') ;
}) ;
 
q.on('next',function(task) {
    console.log('Queue contains '+q.getLength()+' job/s') ;
    console.log('Process task: ') ;
    console.log(task) ;

    //build the message from the task ....
    let message = {
        // Comma separated list of recipients
        to: 'jnuuma@gmail.com',
        // Subject of the message
        subject: '✔ POA Sokol Ballot(s) created' + task['id'],
        // plaintext body
        text: 'yada',
        // HTML body
        html:
            '<p><b>Hello</b> to myself <img src="cid:note@example.com"/></p>' +
            '<p>Here\'s a nyan cat for you as an embedded attachment:<br/><img src="cid:nyan@example.com"/></p>' +
            '<br/><b><i>' + JSON.stringify( task ) + '</b.</i>,',

        // An array of attachments
        attachments: [
            // File Stream attachment
            {
                filename: 'nyan cat.gif',
                path: __dirname + '/assets/nyan.gif',
                cid: 'nyan@example.com' // should be as unique as possible
            }
        ]
    };
 

    return new Promise(function(resolve,reject) { 
        transporter.sendMail(message, (error, info) => {
            if (error) {
                console.log('Error occurred');
                console.log(error.message);
                reject(error);
            }

            console.log('Message sent successfully!');
            console.log(nodemailer.getTestMessageUrl(info));

            // only needed when using pooled connections
            //transporter.close();
            // Must tell Queue that we have finished this task 
            // This call will schedule the next task (if there is one) 
            q.done() ;
            resolve();
        } );

    });
    
}) ;
 
// Stop the queue when it gets empty 
q.on('empty',function() {
    console.log('Queue contains '+q.getLength()+' job/') ;
    q.stop() ;
    q.close()
    .then(function() {
        process.exit(0) ;
    })
}) ;
 
q.on('stop',function() {
    console.log('Stopping queue') ;
}) ;
 
q.on('close',function() {
    console.log('Closing SQLite DB') ;
}) ;
 
q.open()
.then(function() {
    console.log('yada');
    q.add(task1)
     .add(task2)
     .add(task3)
     .add(task4)
    .start() ;
})
.catch(function(err) {
    console.log('Error occurred:') ;
    console.log(err) ;
    process.exit(1) ;
}) ;