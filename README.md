# NO LONGER MAINTAINED

If you want it, fork it. Just don't ask me to fix it.

---

# Twitter Whitewaller

Trashes tweets in bulk with options to keep the important ones.

## Requirements

Currently only for Node JS.

You'll need *node*, *npm* and *git*. You'll also need to [register a Twitter app](https://dev.twitter.com/apps/new).


## Install via Git

Install dependencies and initialize your OAuth credentials as follows:

    $ git clone https://github.com/timwhitlock/twitter-whitewaller.git
    $ cd twitter-whitewaller
    $ npm install
    $ node tw.js init
    
Your OAuth credentials are saved to a file at `app/tw-conf.json`. You may want to remove this between uses for security reasons.
    
## Usage

Edit (or copy and edit) `tw.js` and simply run it:

`$ node tw.js`

When running, it pages backwards through your Twitter timeline. When you hit an API rate limit, 
just leave it to wait and it will carry on when it can. If it quits, the paging will start again. 
If it reaches the end of your timeline it can either stop or start again after a delay.


## Options

You can choose to keep tweets of a certain age, with certain tags and whether they've been retweeted or favourited by others.

See `tw.js` for fuller documentation of these options.

## Limitations

The Twitter API will only provide access to your [last 3,200](https://dev.twitter.com/docs/api/1.1/get/statuses/user_timeline) tweets (16 'pages'). 

However, if you've downloaded a complete Tweet archive from [your Twitter settings](https://twitter.com/settings/account) you can use this as an alternative data source using the `archive` option. 
This comes with its own limitations as favourites and retweet counts are not present in the data and are not pulled separately from the API.
