var forever = require('forever-monitor');

var child = new (forever.Monitor)('hello.js', {
    max: 3,
    silent: false,
    args: ['beer!!!'],
    //logFile: 'forever.log',
    //outFile: 'forever.log'
  });

child.on('exit', function () {
    console.log('hello.js has exited after 3 restarts');
  });

child.start();
