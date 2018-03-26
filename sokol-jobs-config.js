var forever = require('forever-monitor');

var child = new (forever.Monitor)('./getSokolVotingBallots.js', {
    silent: true,
  });

child.on('exit', function () {
    console.log('getSokolVotingBallots.js has exited');
  });

child.start();


var child2 = new (forever.Monitor)('./getSokolThresholdBallot.js', {
  silent: true,
});

child2.on('exit', function () {
  console.log('getSokolThresholdBallot.js has exited');
});

child2.start();


var child3 = new (forever.Monitor)('./getSokolProxyBallot.js', {
  silent: true,
});

child3.on('exit', function () {
  console.log('getSokolProxyBallot.js has exited');
});

child3.start();

