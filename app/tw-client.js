/**
 * Twitter Whitewaller - core module code
 */


// libs
var fs = require('fs'),
    sys = require('sys');

// vars in scope
var conf = {
        maxAge: 2592000,
        minRTs: 1,
        replies: false,
        ownFavs: true,
        minFavs: 1,
        hashTags: [ 'bookmarked' ],
        archive: ''
    },
    dbPath = __dirname+'/tw-conf.json',
    client = require('twitter-api').createClient(),
    archive,
    userId,
    maxId;

// exit codes
var EXIT_UNAUTHED = 1,
    EXIT_AUTHFAIL = 2,
    EXIT_FSFAIL   = 3,
    EXIT_TWFAIL   = 4;



/**
 * Simple command line input prompt
 */
function prompt( text, callback ){
    console.log( text );
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', function(input) {
        process.stdin.pause();
        callback( input.replace(/\s/,'') );
    } );
}



/**
 * String padding utility
 */
function lpad( str, chr, len ){
    while( str.length < len ){
        str = ( chr||' ' ) + str;
    }
    return str;
}



/**
 * Common point to handle any errors from Twitter API calls
 */
function handleTwitterError( status, error, resume ){
    var ms;
    switch( status ){
    case 401: 
        console.error('Run again with: $ node tw.js init');
        process.exit( EXIT_AUTHFAIL );
    case 502:
    case 503:
        // probably temporary errors
        if( resume ){
            ms = 5000;
        }
        break;
    case 429:
        // handle rate limiting if resume function passed
        if( resume ){
            var dt = client.getRateLimitReset(),
                ms = 2000 + Math.max( 0, dt.getTime() - Date.now() ),
                ft = lpad( String(dt.getHours()), '0', 2) +':'+ lpad( String(dt.getMinutes()), '0', 2 );
            console.log('Will try again at '+ft);
        }
        break;
    }
    if( resume ){
        if( ms ){
            console.log('Resuming in '+Math.ceil(ms/1000)+' seconds');
            setTimeout( resume, ms );       
        }
        else {
            console.log('Resuming immediately');
            resume();
        }
    }
    else {
        console.error('Exiting on status '+status+': error #'+error.code+', '+error.message);
        process.exit( EXIT_TWFAIL );
    }
}



/**
 * Initialize OAuth config with interactive shell
 */
function init( callback ){
    // get oauth consumer key from command line prompt
    function getConsumerKey(){
        prompt( 'Enter OAuth consumer key:', function( key ){
            consumerKey = key;
            getConsumerSecret();
        } );
    }
    // get oauth consumer secret from command line prompt
    function getConsumerSecret(){
        prompt( 'Enter OAuth consumer secret:', function( secret ){
            consumerSec = secret;
            client.setAuth( consumerKey, consumerSec );
            getRequestToken();
        } );
    }
    // get oauth request token from Twitter API
    function getRequestToken(){
        console.log('Fetching request token from Twitter..');
        client.fetchRequestToken( 'oob', function( token, data, status ){
            if( ! token ){
                console.error('Twitter failure: status '+status+', failed to fetch request token');
                process.exit( EXIT_AUTHFAIL );
            }
            client.setAuth( consumerKey, consumerSec, token.key, token.secret );
            prompt('Enter verifier from '+token.getAuthorizationUrl(), getAccessToken );
        } );
    }
    // get oauth access token from verifier code
    function getAccessToken( verifier ){
        console.log('Requesting access token from Twitter..');
        client.fetchAccessToken( verifier, function( token, data, status ){
            if( ! token ){
                console.error('Twitter failure: status '+status+', failed to obtain access token');
                process.exit( EXIT_AUTHFAIL );
            }
            console.log('OK, saving credentials..');
            saveConfigFile( data );
        } );
    }
    // write credentials to local JSON file
    function saveConfigFile( data ){
        var blob = JSON.stringify( { 
            id: data.user_id, 
            name: data.screen_name, 
            auth: [ consumerKey, consumerSec, data.oauth_token, data.oauth_token_secret ]
        } );
        fs.writeFile( dbPath, blob, function (err) {
            if( err ){
                console.error( err.message||err );
                process.exit( EXIT_FSFAIL );
            }
            console.log('Credentials written to '+dbPath );
            callback( blob );
        } ); 
    }
    // start chain of process by getting consumer key from stdin
    var consumerKey, consumerSec;
    getConsumerKey();
}



/**
 * Fetch OAuth config from file or exit with instructions
 */
function load( callback ){
    fs.exists( dbPath, function( exists ){
        if( ! exists ){
            // no db file - prompt initializing run
            console.error('OAuth not configured. Run with $ node tw.js init');    
            process.exit( EXIT_UNAUTHED );
        }
        // pull oauth creds from file and setin client
        fs.readFile( dbPath, function( err, data ){
            if( err ){
                console.error( err.message||err );
                process.exit( EXIT_FSFAIL );
            }
            data = JSON.parse( data );
            if( ! data.auth || ! data.id ){
                console.error('Bad OAuth config. Run again with $ node tw.js init');
                process.exit( EXIT_UNAUTHED );
            }
            userId = data.id;
            client.setAuth.apply( client, data.auth );
            // verify credentials before using
            client.get( 'account/verify_credentials', { skip_status: true }, function( user, error, status ){
                if( ! user || error ){
                    return handleTwitterError( status, error );
                }
                console.log('Client authenticated as @'+user.screen_name+', #'+userId );
                callback();
            } );
        } );
    } );
}




/**
 * Check if current user favourited a given tweet
 */
function checkOwnFavourite( status_id, callback ){
    var params = {
        max_id: status_id,
        count: 1,
        user_id: userId
    };
    client.get( 'favorites/list', params, function( tweets, error, status ){
        if( ! tweets || error ){
            var resume = function(){ checkOwnFavourite( status_id, callback ); }
            handleTwitterError( status, error, resume );
        }
        callback( tweets[0] && ( status_id === tweets[0].id_str ), tweets[0] );
    } );
}




/**
 * Get next page of tweets, going backwards through time
 */
function nextPage( callback ){
    // Get tweets from local archive if configured
    if( conf.archive ){
        if( ! archive ){
            archive = fs.readdirSync( conf.archive );
        }
        var filename = archive.pop();
        if( ! filename ){
            console.log('No more tweets in archive, quitting');
            process.exit(0);
        }
        // load these tweets via a GLOBAL hack
        Grailbird = { data: {} };
        require( conf.archive+'/'+filename );
        var key;
        for( key in Grailbird.data ){
            callback( Grailbird.data[key] );
        }
        return;
    }
    // else get page of tweets via API  
    var params = { 
        count: 200, 
        user_id : userId, 
        trim_user: true,
        include_rts: false
    };
    if( null != maxId ){
        params.max_id = maxId;
    }        
    client.get( 'statuses/user_timeline', params, function( tweets, error, status ){
        if( ! tweets || error ){
            return handleTwitterError( status, error, run );
        }
        if( maxId ){
            var tweet = tweets.shift();
            if( ! tweet || tweet.id_str !== maxId ){
                // console.error('Expecting first tweet to match max_id '+maxId+', got '+(tweet?tweet.id_str:'none') );
                // not sure why this happens, but possibly due to tweeting while running.
                // process.exit( EXIT_TWFAIL );
                tweet && tweets.unshift(tweet);
            }
        }
        if( ! tweets.length ){
            if( ! conf.idleTime ){
                console.log('No more tweets in API, quitting');
                process.exit(0);
            }
            console.log('No more tweets, running again in '+conf.idleTime+' seconds..');
            maxId = null;
            setTimeout( run, conf.idleTime * 1000 );
            return;
        }
        callback( tweets );
    } );    
}



/**
 * Delete a given tweet
 */
function destroyTweet( status_id, callback ){
    console.log('Deleting '+status_id+' ..');
    client.post( 'statuses/destroy/'+status_id, { trim_user: true }, function( tweet, error, status ){
        if( 200 === status ){
            console.log('Deleted');
        }
        else if( 404 !== status ){
            var resume = function(){ destroyTweet( status_id, callback ); };
            return handleTwitterError( status, error, resume );
        }
        callback();
    } );
}



/**
 * Run whitewalling process with Twitter client now authenticated
 */
function run(){
    // process next available tweet or run again
    function nextTweet(){
        if( tweet = tweets.shift() ){
            checkTweet();
        }
        else {
            setTimeout( run, 100 );
        }
    }
    // run all tests on tweet
    function checkTweet(){
        maxId = tweet.id_str;
        console.log('');
        console.log('['+tweet.created_at+'] "'+tweet.text+'"');
        checkAge();
    }
    // skip if new enough to keep
    function checkAge(){
        var age = now - Date.parse( tweet.created_at );
        if( age <= maxAge ){
            console.log('Keeping tweet '+Math.floor(age/86400000)+' days old');
            return nextTweet();
        }        
        checkReply();
    }
    // skip if replying to another user
    function checkReply(){
        if( conf.replies && tweet.in_reply_to_status_id ){
            console.log('Keeping tweet in reply to @'+tweet.in_reply_to_screen_name);
            return nextTweet();
        }
        checkRTs();
    }
    // skip if enough retweets to keep
    function checkRTs(){
        if( conf.minRTs && tweet.retweeted && conf.minRTs <= tweet.retweet_count ){
            console.log('Keeping tweet retweeted '+tweet.retweet_count+' times');
            return nextTweet();
        }
        checkNumFavs();
    }
    // skip if enough favourites to keep it
    function checkNumFavs(){
        if( conf.minFavs && tweet.favorited && conf.minFavs <= tweet.favorite_count ){
            console.log('Keeping tweet favourited '+tweet.favorite_count+' times');
            return nextTweet();
        }
        checkTags();
    } 
    // check if tweet is tagged by a term meaning we keep it
    function checkTags(){
        var keep = false,
            tags = tweet.entities && tweet.entities.hashtags;
        if( tags && tags.length && conf.hashTags && conf.hashTags.length ){
            var terms = [];
            tags.forEach( function( tag ){
                tag.text && terms.push( tag.text );
            } );
            conf.hashTags.forEach( function( term, i ){
                if( -1 !== terms.indexOf(term) ){
                    console.log('Keeping tweet tagged #'+term);
                    keep = true;
                }
            } );
        }
        keep ? nextTweet() : checkOwnFavs();
    }
    // check if favourited by self
    function checkOwnFavs(){
        if( ! conf.ownFavs || ! tweet.favorited ){
            return checkFinal();
        }
        checkOwnFavourite( tweet.id_str, function( favourited ){
            if( favourited ){
                console.log('Keeping tweet favourited by self');
                return nextTweet();
            }
            checkFinal();
        } );
    }
    // final check before deleting
    function checkFinal(){
        destroyTweet( tweet.id_str, nextTweet ); 
    }
    var tweet, 
        tweets = [],
        now = Date.now(), 
        maxAge = 1000 * conf.maxAge;
    // get next batch and process if results
    nextPage( function( list ){
        console.log('Processing '+list.length+' tweets');
        tweets = list;
        nextTweet();
    } );
}





/**
 * Main entry from bootstrap file ../tw.js
 */
exports.run = function( userConf ){

    // initialize oauth if arguments passed to command
    var args = process.argv;
    if( args[2] && 'init' === args[2] ){
        init( function( data ){
            console.log('Configured OK. Run as $ node tw.js');
            process.exit(0);
        } );
        return;
    }

    // override user configs of valid type
    var key, value;
    for( key in userConf||{} ){
        value = userConf[key];
        if( typeof value === typeof conf[key] ){
            conf[key] = value;
        }
    }
    
    // debug / override options
    if( userConf.startId ){
        maxId = userConf.startId;
    }

    // load existing conf and run
    console.log( 'Running with config: '+sys.inspect(conf).replace(/\s+/g,' ') );
    load( run );
    
}






