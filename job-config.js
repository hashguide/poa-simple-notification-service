var forever = require('forever-monitor');

var child = new (forever.Monitor)('./getVotingBallots.js', {
    silent: true,
  });

child.on('exit', function () {
    console.log('getVotingBallot.js has exited');
  });

child.start();


var child2 = new (forever.Monitor)('./queue.js', {
  silent: true,
});

child2.on('exit', function () {
  console.log('queue.js has exited');
});

child2.start();
