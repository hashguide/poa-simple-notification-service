var EventEmitter = require('events').EventEmitter ;
var sqlite3 = require('sqlite3').verbose();
var log4js = require('log4js');

log4js.configure({
    appenders: { mq: { type: 'file', filename: 'mq.log' } },
    categories: { default: { appenders: ['mq'], level: 'debug' } }
  });

var logger = log4js.getLogger('mq');


/**
 * Default queue table memo for the sqlite db
 * @type {string}
 * @const
 * @default
 */
var table = 'mq' ;

/**
 * Default counter table memo for the sqlite db
 * @type {string}
 * @const
 * @default
 */
//var table_count = 'queue_count' ;

/**
 * Simple SQLite backed Queue for running many short tasks in Node.js
 * @param {string} [filename=:memory:] Path to sqlite db for queue db
 * @param {integer} [batchSize=3] The number of rows from queue db to retrieve at a time
 * @constructor
 */
function PersistentQueue(filename,batchSize) {
	// Call super-constructor
	EventEmitter.call(this) ;

	// Copy our instance for closures
	var self = this ;

	// If filename not provided, then throw error
	if(filename === undefined)
		throw new Error('No filename parameter provided') ;

	/**
	 * Set to true to enable debugging mode
	 * @type {boolean}
	 * @access private
	 */
	this.debug = true ;

	/**
	 * Instance variable for whether the queue is empty (not known at instantiation)
	 * @type {boolean}
	 * @access private
	 */
	this.empty = undefined ;

	/**
	 * Path to the sqlite db file
	 * @type {string}
	 * @access private
	 */
	this.dbPath = (filename === '') ? ':memory:' : filename ;

	/**
	 * How many objects to retrieve from DB into queue array at a time
	 */
	this.batchSize = (batchSize === undefined) ? 10 : batchSize ;
	if(typeof this.batchSize !== 'number' || this.batchSize < 1)
		throw new Error('Invalid batchSize parameter.  Must be a number > 0') ;

	/**
	 * The queue of objects to operate on
	 * @type {Array}
	 * @access private
	 */
	this.queue = [] ;

	/**
	 * Keep track of total number of jobs in queue
	 * @type {integer}
	 * @access private
	 */
	this.length  = null ;

	/**
	 * The sqlite database object handle
	 * @type {sqlite3.Database}
	 * @access private
	 */
	this.db = null ;

	/**
	 * The queue's sqlite database is open
	 * @type {boolean}
	 * @access private
	 */
	this.opened = false ;

	/**
	 * Should the queue process messages
	 * @type {boolean}
	 * @access private
	 */
	this.run = false ;

	this.on('start',function() {
		if(self.db === null)
			throw new Error('Open queue database before starting queue') ;

		if(self.run === false) {
			self.run = true ;
			self.emit('trigger_next') ;
		}
	}) ;

	this.on('stop',function() {
		self.run = false ;
	}) ;

	this.on('trigger_next',function() {
		if(self.debug) logger.debug('trigger_next') ;
		//Check state of queue
		if(!self.run || self.empty) {
			if(self.debug) logger.debug('run='+self.run+' and empty='+self.empty) ;
			if(self.debug) logger.debug('not started or empty queue') ;
			// If queue not started or is empty, then just return
			return ;
		}

		// Define our embedded recursive function to be called later
		function trigger() {
			self.emit('next',self.queue[0]) ;
		}

		// If our in-memory list is empty, but queue is not, re-hydrate from db
		if(self.queue.length === 0 && self.length !== 0) {

			hydrateQueue(this,this.batchSize)
			.then(function() {
				// Schedule job for next check phase in event loop
				setImmediate(trigger) ;
			})
			.catch(function(err) {
				console.error(err) ;
				process.exit(1) ;
			}) ;
		} else if(self.queue.length) { // If in-memory queue not empty, trigger next job
			// https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
			setImmediate(trigger) ;
		} else { // Otherwise queue is empty
			self.emit('empty') ;
		}
	}) ;

	// Set instance to empty on empty event
	this.on('empty',function() {
		self.empty = true ;
	}) ;

	// If a job is added, trigger_next event
	this.on('add',function(job) {
		if(self.empty) {
			self.empty = false ;
			if(self.debug) logger.debug('No longer empty') ;
			if(self.run)
				self.emit('trigger_next') ;
		}
	}) ;

	this.on('open',function(db) {
		self.opened = true ;
	}) ;

	// Unset the db variable when db is closed
	this.on('close',function() {
		self.opened = false ;
		self.db = null ;
		self.empty = undefined ;
		self.run = false ;
		self.queue = [] ;
	}) ;
}

PersistentQueue.prototype = Object.create(EventEmitter.prototype) ;

/**
 * Open sqlite database
 *
 * @return {Promise}
 */
PersistentQueue.prototype.open = function open( hydrate ) {
	var self = this ;

	// return a promise from open method from:
	return new Promise(function(resolve,reject) {
		// Opening db
		self.db = new sqlite3.Database(self.dbPath,sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,function(err) {
			if(err !== null)
				reject(err) ;
			resolve() ;
		}) ;
	})
	.then(function() {
		// Create and initialise tables if they doesnt exist
		return new Promise(function(resolve,reject) {

			query = " \
					CREATE TABLE IF NOT EXISTS mq \
						( id INTEGER PRIMARY KEY, \
						network VARCHAR(25) NOT NULL, \
						contractAddress VARCHAR(50) NOT NULL, \
						ballotId INTEGER NOT NULL, \
						toEmail VARCHAR(125) NOT NULL, \
						block INTEGER NOT NULL, \
						memo TEXT,\
						status VARCHAR(25) NOT NULL DEFAULT 'initial', \
						created DATETIME NOT NULL DEFAULT ( Datetime('now') ), \
						updated DATETIME, \
					    unique ( contractAddress, ballotId, toEmail ) ); \
					";

			self.db.exec(query,function(err) {
				if(err !== null) reject(err) ;
            resolve();

			}) ;
		}); 	
	})
	.then(function() {
        //logger.debug("count");
		return countQueue(self) ;
	})
	.then(function() {
        // Load batchSize number of jobs from queue (if there are any)
		logger.debug('hydrate = ' + hydrate );
		//what don't like this.
		if ( hydrate ) {
			return hydrateQueue(self,self.batchSize)
			.then(function(jobs) {
				//If no msg left, set empty to true (but don't emit event)
				self.empty = (self.queue.length === 0) ;

				self.emit('open',self.db) ;
				return Promise.resolve(jobs) ;
			}) ;
		}
	}) ;
} ;

/**
 * Close the sqlite database
 *
 * @return {Promise}
 */
PersistentQueue.prototype.close = function close() {
	var self = this ;
	return new Promise(function(resolve,reject) {
		self.db.close(function(err) {
			if(err)
				reject(err) ;
			self.emit('close') ;
			resolve() ;
		}) ;
	}) ;
} ;

/**
 * Get the total number of jobs in the queue
 *
 * @return {integer} Total number of jobs left to run
 */
PersistentQueue.prototype.getLength = function() {
	return this.length ;
} ;

/**
 * Start processing the queue
 */
PersistentQueue.prototype.start = function() {
	this.emit('start') ;
} ;

/**
 * Stop processing the queue
 */
PersistentQueue.prototype.stop = function() {
	this.emit('stop') ;
} ;

/**
 * Called by user from within their 'next' event handler when finished
 *
 * It will remove the current  job from the sqlite queue and emit another 'next' event
 */
PersistentQueue.prototype.done = function() {
	var self = this ;
	if(self.debug) logger.debug('Calling done!') ;
	// Remove the job from the queue
	removeJob(this)
	.then(function() {
		if(self.debug) logger.debug('Job deleted from db') ;
		// Decrement our job length
		self.length-- ;
		self.emit('trigger_next') ;
	})
	.catch(function(err) {
		console.error(err) ;
		process.exit(1) ;
	}) ;
} ;

/**
 * Called by user from within their 'next' event handler when error occurred and job to remain at head of queue
 *
 * It will leave the current job in the queue and stop the queue
 */
PersistentQueue.prototype.abort = function() {
	var self = this ;
	if(self.debug) logger.debug('Calling abort!') ;
	self.stop() ;
} ;

/**
 * Called by user to add a job to the queue
 *
 * @param {Object} job Object to be serialized and added to queue via JSON.stringify()
 * @return {PersistentQueue} Instance for method chaining
 */
PersistentQueue.prototype.add = function(network, block,contractAddress, ballotId, toEmail, memo ) {
	var self = this ;

	self.db.run("INSERT INTO mq (network, block, contractAddress, ballotId, toEmail, memo ) VALUES (?,?,?,?,?,?);", network, block, contractAddress, ballotId, toEmail, JSON.stringify(memo), function(err) {
		if(err)
			logger.error( err ) ;
		else {
			// Increment our job length
			self.length++ ;

			self.emit('add',{ id:this.lastID, job: memo }) ;
		}
	});
	return self ;
} ;

/**
 * Turn on or off the debugging function. Off by default
 *
 * @param {boolean} debug True to turn on, false to turn off
 * @return {PersistentQueue} Instance for method chaining
 */
PersistentQueue.prototype.setDebug = function(debug) {
	this.debug = debug ;
	return this ;
} ;

/**
 * Is the persistent storage queue empty
 *
 * @throws {Error} If open method hasn't been called first
 *
 * @return {boolean} True if empty, false if jobs still remain
 */
PersistentQueue.prototype.isEmpty = function() {
	if(this.empty === undefined)
		throw new Error("Call open() method before calling isEmpty()") ;
	return this.empty ;
} ;

/**
 * Is the queue started and processing jobs
 *
 * @return {boolean} True if started, otherwise false
 */
PersistentQueue.prototype.isStarted = function() {
	return this.run ;
} ;

/**
 * Is the queue's SQLite DB open
 *
 * @return {boolean} True if opened, otherwise false
 */
PersistentQueue.prototype.isOpen = function() {
	return this.opened ;
} ;

/**
 * Get a reference to sqlite3 Database instance
 *
 * @throws {Error} If open method hasn't been called first
 * @return {sqlite3.Database}
 */
PersistentQueue.prototype.getSqlite3 = function() {
	if(this.db === null)
		throw new Error("Call open() method before calling getSqlite3()") ;
	return this.db ;
} ;

/**
 * Returns true if there is a job with 'id' still in queue, otherwise false
 * @param {integer} id The job id to search for
 * @return {Promise} Promise resolves true if the job id is still in the queue, otherwise false
 */
PersistentQueue.prototype.has = function(id) {
	// First search the in-memory queue as its quick

	return new Promise(function(reject,resolve) {
		for(var i=0;i<self.queue.length;i++) {
			if(self.queue[i].id === id)
				resolve(true) ;
		}
		// Now check the on-disk queue
		this.db.get("SELECT id FROM " + table + " where id = ?", id, function(err, row) {
			if(err !== null)
				reject(err) ;

			// Return true if there is a record, otherwise return false
			resolve(row !== undefined) ;
		}) ;
	}) ;
} ;

/**
 * Delete a job from the queue (if it exists)
 * @param {integer} id The job id number to delete
 */
PersistentQueue.prototype.delete = function(id) {
	var self = this ;
	return removeJob(this,id)
	.then(function() {
		if(self.debug) logger.debug('Job deleted from db') ;
		self.emit('delete',{ id: id }) ;
		// Decrement our job length
		self.length-- ;
	}) ;
} ;

function countQueue(self) {
	if(self.debug) logger.debug('>>>>> CountQueue') ;
	return new Promise(function(resolve,reject) {
		if(self.db === null)
			reject('Open queue database before counting jobs') ;

		self.db.get("SELECT COUNT(id) as counter FROM mq WHERE status ='initial' LIMIT 1;", function(err, row) {
			if(err !== null)
				reject(err) ;

            // Set length property to number of rows in sqlite table
            logger.debug(">>>>>>>>>>: " + row.counter );
			self.length = row.counter ;
			resolve(this.length) ;
		}) ;
	}) ;
}

/**
 * This function will load from the database, 'size' number of records into queue array
 * @param size
 */
function hydrateQueue(self,size) {

	if(self.debug) logger.debug('HydrateQueue') ;
	return new Promise(function(resolve,reject) {
		if(self.db === null)
			reject('Open queue database before starting queue') ;

		self.db.all("SELECT id, network, ballotId, toEmail, memo FROM mq WHERE status in ( 'initial', 'retry' ) ORDER BY id ASC LIMIT " + self.batchSize, function(err, jobs) {
			if(err !== null)
				reject(err) ;

			if(self.debug) {
				for(var i = 0; i < jobs.length; i++) {
					if(self.debug) logger.debug(JSON.stringify(jobs[i])) ;
				}
			}
            // Update our queue array (converting stored string back to object using JSON.parse
            self.length = jobs.length;
			self.queue = jobs.map(function(job){
				try {
					return { id: job.id, network: job.network, ballotId: job.ballotId, toEmail : job.toEmail, job: job.memo } ;
				} catch(err) {
					reject(err) ;
				}
			}) ;

			resolve(jobs) ;
		}) ;
	}) ;
}

/**
 * This function will remove the given or current job from the database and in-memory array
 * @param {PersistentQueue} self Instance to work with
 * @param {integer} [id] Optional job id number to remove, if omitted, remove current job at front of queue
 * @return {Promise}
 */
function removeJob(self,id) {
	if(id === undefined) {
		id = self.queue.shift().id ;
	}
	else {
		// Search queue for id and remove if exists
		for(var i=0;i<self.queue.length;i++) {
			if(self.queue[i].id === id) {
				self.queue.splice(i,1) ;
				break ;
			}
		}
	}

	return new Promise(function(resolve,reject) {
		if(self.db === null)
			reject('Open queue database before starting queue') ;

		if(self.debug) logger.debug('About to delete') ;
		if(self.debug) logger.debug('Removing job: '+id) ;
		if(self.debug) logger.debug('From table: '+table) ;
		if(self.debug) logger.debug('With queue length: '+self.length) ;
		self.db.run("UPDATE mq set status = 'sent', updated = DATETIME('now') WHERE id = ?", id, function(err) {
			if(err !== null)
				reject(err) ;

			if(this.changes) // Number of rows affected (0 == false)
				resolve(id) ;

			reject("Job id "+id+" was not removed from queue") ;
		});
	}) ;
}

module.exports = PersistentQueue;
