//want to test the logging infrastructure as well as test passing
//params from forever bootstrap script.
var log4js = require('log4js');
log4js.configure({
    appenders: { hello: { type: 'file', filename: 'hello.log' } },
    categories: { default: { appenders: ['hello'], level: 'debug' } }
  });
var logger = log4js.getLogger();
logger.info( 'yada, yada' );
logger.debug( 'hey there: ' + process.argv[2] );
