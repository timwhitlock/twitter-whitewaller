/**
 * Twitter Whitewaller
 */


var conf = {

    // maximum age a Tweet is allowed to be, in seconds. Defaults to 30 days.
    maxAge: 2592000,
    
    // whether to keep replies to other users. Defaults to false
    replies: false,

    // minimum number of retweets required to keep a Tweet. Defaults to 1.
    minRTs: 1,

    // minimum number of favourites by others required to keep a Tweet. Defaults to 1.
    minFavs: 1,

    // whether to keep Tweets that you have *yourself* favourited. Defaults to true.
    ownFavs: true,
    
    // hashtags marking that a tweet should be kept, Defaults to "#bookmarked"
    hashTags: [ 'bookmarked' ],

    // seconds to wait before running again after last tweet is reached. defaults to 0 which quits instead
    idleTime: 0,
    
    // initial max_id to use in paging, used for debugging.
    startId: null
};



// run core app with configuration
require('./app/tw-client').run( conf );