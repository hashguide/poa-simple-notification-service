# poa-simple-notification-service

### Problem statement:

POA Networks is the first public blockchain that supports Ethereum contracts built using PoA ( Proof of Authority ) by independant individuals, known as Validators. Additionally POA provide an online governance model to manage both the set of Validators participating inru the Consensus protocol and well and the underlying contracts managing Governance, i.e. the ballot and voting processes.

Currently, there is no well-defined way for the set of Valiators to be notified when a Ballot. Ad hoc methods are being used to notification, email, Telegram, SMS which is undesirable and a vulnerability to the Governance model.  

See the following for more information regarding POA Network:

- https://poa.network/ 
- https://github.com/poanetwork/wiki

## Solution proposal

This project is an first cut attempt to build a light weight notification framework in nodejs as there is existing code and scripts written in Javascript that can be leveraged and provides an efficatious implementation path.  This general infrastucture will be publish/subscribe, where by Publisher are responsible for querying contracts for new BallotCreated events and publish to a persistent store ( sqlite3 ).  The Subscriber will be responsible for consuming the events, sending notification ( via email initially ) and managing the persistent queue.

This infrastructure can be run as centralize service where all Validators contact information is stored or can be installed and configured by a willing Validator ( if they are uncomfortable with a centralized approach and have technical capabilities to install, monitor & maintain ).

### Dependencies:

- forever -- used to run components as a service

  - ( https://github.com/foreverjs/forever )
  - ( https://github.com/foreverjs/forever-monitor )

  - sudo npm install forever -g
  - sudo npm install forever-monitor

- sqlite3 -- used for persistent storage 
   - ( https://www.npmjs.com/package/sqlite3 )
   - sudo npm install sqlite3

- log4js -- logging infrastrure so processes can have human readable logs for debugging analysis.
NOTE: Wonder if there is logging infracture with DB support which can be used to persist new Ballots
   - ( https://www.npmjs.com/package/log4js )
   - sudo npm install log4js


## Current state

-  getVotingBallot.js
   -  This component queries most recent VotingToChangeKeys.sol deployed on POA testnet Sokol and prints to std.out.  Additionally, this component persistently stores last block queried to disk so that next time the query runs it looks for only new voting Ballots.   
   
- mq.js - This component is the DB access layer into the sqlite3 DB

- queue.js -  This component acts as the subscriber.  It will periodically wake up and processes rows in the persistent store.







