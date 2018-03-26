var forever = require('forever-monitor');

var child = new (forever.Monitor)('./getCoreBallot.js', {
    silent: true,
  });

child.on('exit', function () {
    console.log('getCoreBallot.js has exited');
  });

child.start();


var child2 = new (forever.Monitor)('./getCoreThresholdBallot.js', {
  silent: true,
});

child2.on('exit', function () {
  console.log('getCoreThresholdBallot.js has exited');
});

child2.start();


var child3 = new (forever.Monitor)('./getCoreProxyBallot.js', {
  silent: true,
});

child3.on('exit', function () {
  console.log('getCoreProxyBallot.js has exited');
});

child3.start();



var child4 = new (forever.Monitor)('./queue.js', {
  silent: true,
});

child4.on('exit', function () {
  console.log('queue.js has exited');
});

child4.start();
